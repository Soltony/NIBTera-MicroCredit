
import { prisma } from '@/lib/prisma';
import type { LoanProvider } from '@/lib/types';

async function getProviders(): Promise<LoanProvider[]> {
    const providers = await prisma.loanProvider.findMany({
        include: {
            products: true,
        },
        orderBy: {
            displayOrder: 'asc'
        }
    });
    return providers;
}


export default async function ApplyLayout({children}: {children: React.ReactNode}) {
  const providers = await getProviders();

  // We need to pass providers down to the client component.
  // We can do this by wrapping the children in a component that has access to providers.
  const childrenWithProps = React.cloneElement(children as React.ReactElement, { providers });

  return <>{childrenWithProps}</>;
}
