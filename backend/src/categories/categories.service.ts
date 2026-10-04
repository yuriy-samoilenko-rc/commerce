import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService, changedKeys } from '../audit/audit.service';
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

  async remove(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: { _count: { select: { children: true, products: true } } },
    });
    if (!category) throw new NotFoundException('Category not found');
    const { children, products } = category._count;
    if (children || products) {
      throw new ConflictException(
        `Category has ${children} subcategories and ${products} products; move them first`,
      );
    }
    await this.prisma.category.delete({ where: { id } });
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
      throw new BadRequestException('Parent category does not exist');

    for (
      let cur: string | null | undefined = newParentId;
      cur;
      cur = parentOf.get(cur)
    ) {
      if (cur === id) {
        throw new BadRequestException(
          'A category cannot be moved inside itself or its subcategory',
        );
      }
    }
  }
}
