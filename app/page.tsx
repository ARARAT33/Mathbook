import React from 'react';
import { validatePageNumber } from '@/lib/book-structure';
import type { WorkspaceTab } from '@/components/TopHeader';
import { BookStudioClient } from '@/components/BookStudioClient';

interface HomePageProps {
  searchParams: Promise<{ page?: string; view?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const parsedPage = params.page ? Number(params.page) : 1;
  const initialPage = Number.isNaN(parsedPage) ? 1 : validatePageNumber(parsedPage);

  const rawView = params.view;
  const initialView: WorkspaceTab =
    rawView === 'toc' || rawView === 'batch' || rawView === 'compiled'
      ? rawView
      : 'reader';

  return <BookStudioClient initialPage={initialPage} initialView={initialView} />;
}
