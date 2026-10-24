// app/pages/NotFoundPage.tsx
import { LinkButton } from '@/components/Button';
import { PageHeader } from '@/components/PageHeader';

export function NotFoundPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Page not found" subtitle="That address does not exist in the demo." />
      <LinkButton to="/">Back to start</LinkButton>
    </div>
  );
}
