import { notFound } from "next/navigation";

// Any address the shop does not know shows the shop's 404 (with its header and footer).
export default function UnknownPage() {
  notFound();
}
