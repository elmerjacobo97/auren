import { useParams } from "@tanstack/react-router";
import { BlockDetailPage } from "@/catalog/views/block-detail-page";

export function BlockDetailRoute() {
  const { id } = useParams({ from: "/blocks/$id" });

  return <BlockDetailPage id={id} />;
}
