import type { CategoryTree } from "./backend-types";

export interface FlatCategory {
  id: string;
  name: string;
  depth: number;
  /** "Televizori / OLED" — for places that show one category without the tree around it. */
  path: string;
}

/** The category tree in display order, each entry knowing how deep it sits. */
export function flattenCategories(tree: CategoryTree, depth = 0, parent = ""): FlatCategory[] {
  return tree.flatMap((node) => {
    const path = parent ? `${parent} / ${node.name}` : node.name;
    return [{ id: node.id, name: node.name, depth, path }, ...flattenCategories(node.children, depth + 1, path)];
  });
}

/** Option text with the nesting shown by indentation (a native <select> has no tree). */
export const indented = (c: FlatCategory) => `${"   ".repeat(c.depth)}${c.name}`;
