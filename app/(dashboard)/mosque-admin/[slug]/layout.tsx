import { requireFinanceAccessBySlug } from '@/lib/finance-access';

export default async function MosqueAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireFinanceAccessBySlug(slug);

  return <>{children}</>;
}
