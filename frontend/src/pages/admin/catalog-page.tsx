import { TaxonomyPanel } from "@/features/catalog/taxonomy-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function AdminCatalogPage() {
  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Danh mục & thương hiệu
        </h1>
        <p className="text-sm text-muted-foreground">
          Quản lý danh mục và thương hiệu dùng để phân loại sản phẩm.
        </p>
      </div>
      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Danh mục</TabsTrigger>
          <TabsTrigger value="brands">Thương hiệu</TabsTrigger>
        </TabsList>
        <TabsContent value="categories" className="mt-4">
          <TaxonomyPanel kind="categories" noun="danh mục" />
        </TabsContent>
        <TabsContent value="brands" className="mt-4">
          <TaxonomyPanel kind="brands" noun="thương hiệu" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
