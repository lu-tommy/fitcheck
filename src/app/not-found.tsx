import { Compass } from 'lucide-react';

import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center">
      <EmptyState
        icon={<Compass size={26} />}
        title="There is nothing here"
        body="That page does not exist. Your wardrobe is untouched."
        action={<ButtonLink href="/">Back to the home screen</ButtonLink>}
      />
    </div>
  );
}
