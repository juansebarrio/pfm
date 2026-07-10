import { TabBar } from "@/components/sistema/TabBar";

export default function LayoutTabs({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <main className="pb-[110px]">{children}</main>
      <TabBar />
    </>
  );
}
