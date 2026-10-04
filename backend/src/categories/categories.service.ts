import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService, changedKeys } from '../audit/audit.service';
import { badRequest, conflict } from '../common/errors';
import { uniqueSlug } from '../common/slug';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  children: CategoryNode[];
}

export interface ManagedCategory extends Omit<CategoryNode, 'children'> {
  products: number;
  totalProducts: number;
  children: ManagedCategory[];
}

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // The category table is small (tens to hundreds of rows), so the whole tree is
  // built in memory from one query instead of recursive SQL.
  async findTree(): Promise<CategoryNode[]> {
    const rows = await this.prisma.category.findMany({
      select: { id: true, name: true, slug: true, parentId: true },
      orderBy: { name: 'asc' },
    });
    const nodes = new Map<string, CategoryNode>(
      rows.map((r) => [r.id, { ...r, children: [] }]),
    );
    const roots: CategoryNode[] = [];
    for (const node of nodes.values()) {
      const parent = node.parentId ? nodes.get(node.parentId) : undefined;
      (parent ? parent.children : roots).push(node);
    }
    return roots;
  }

  /**
   * For the catalog screen: the tree with product counts, own (`products`) and
   * including every subcategory (`totalProducts`).
   */
  async manageTree() {
    const rows = await this.prisma.category.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        _count: { select: { products: true } },
      },
      orderBy: { name: 'asc' },
    });
    const nodes = new Map<string, ManagedCategory>(
      rows.map(({ _count, ...r }) => [
        r.id,
        { ...r, products: _count.products, totalProducts: 0, children: [] },
      ]),
    );
    const roots: ManagedCategory[] = [];
    for (const node of nodes.values()) {
      const parent = node.parentId ? nodes.get(node.parentId) : undefined;
      (parent ? parent.children : roots).push(node);
    }
    const total = (n: ManagedCategory): number =>
      (n.totalProducts = n.children.reduce((s, c) => s + total(c), n.products));
    roots.forEach(total);
    return roots;
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true } },
        children: {
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async create(dto: CreateCategoryDto) {
    const slug = await uniqueSlug(dto.name, async (s) =>
      Boolean(await this.prisma.category.findUnique({ where: { slug: s } })),
    );
    return this.prisma.category.create({ data: { ...dto, slug } });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    if (dto.parentId) await this.assertNoCycle(id, dto.parentId);
    return this.audit.trackUpdate(
      () => this.prisma.category.findUnique({ where: { id } }),
      () => this.prisma.category.update({ where: { id }, data: dto }),
      changedKeys(dto),
    );
  }

  /**
   * Deletes a category. One with products or subcategories needs `moveTo`: they
   * go there first (it must not be the category itself or inside it).
   */
  async remove(id: string, moveTo?: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: { _count: { select: { children: true, products: true } } },
    });
    if (!category) throw new NotFoundException('Category not found');
    const { children, products } = category._count;
    if ((children || products) && !moveTo) {
      throw conflict(
        'CATEGORY_NOT_EMPTY',
        `Category has ${children} subcategories and ${products} products; move them first`,
        { children, products },
      );
    }
    if (moveTo) {
      const inside = await this.withDescendantIds(id);
      const target = await this.prisma.category.findUnique({
        where: { id: moveTo },
      });
      if (!target || inside.includes(moveTo)) {
        throw badRequest(
          'MOVE_TO_INVALID',
          'Target must be an existing category outside the deleted one',
        );
      }
    }
    await this.prisma.$transaction([
      ...(moveTo
        ? [
            this.prisma.product.updateMany({
              where: { categoryId: id },
              data: { categoryId: moveTo },
            }),
            this.prisma.category.updateMany({
              where: { parentId: id },
              data: { parentId: moveTo },
            }),
          ]
        : []),
      this.prisma.category.delete({ where: { id } }),
    ]);
  }

  // Returns the category id plus all nested subcategory ids, so filtering by
  // "Электроника" also returns products from "Смартфоны", "Ноутбуки", etc.
  async withDescendantIds(id: string): Promise<string[]> {
    const rows = await this.prisma.category.findMany({
      select: { id: true, parentId: true },
    });
    const childrenOf = new Map<string, string[]>();
    for (const r of rows) {
      if (!r.parentId) continue;
      childrenOf.set(r.parentId, [...(childrenOf.get(r.parentId) ?? []), r.id]);
    }
    const result = [id];
    for (let i = 0; i < result.length; i++) {
      result.push(...(childrenOf.get(result[i]) ?? []));
    }
    return result;
  }

  private async assertNoCycle(id: string, newParentId: string) {
    const rows = await this.prisma.category.findMany({
      select: { id: true, parentId: true },
    });
    const parentOf = new Map(rows.map((r) => [r.id, r.parentId]));
    if (!parentOf.has(newParentId))
      throw badRequest('CATEGORY_CYCLE', 'Parent category does not exist');

    for (
      let cur: string | null | undefined = newParentId;
      cur;
      cur = parentOf.get(cur)
    ) {
      if (cur === id) {
        throw badRequest(
          'CATEGORY_CYCLE',
          'A category cannot be moved inside itself or its subcategory',
        );
      }
    }
  }
}
