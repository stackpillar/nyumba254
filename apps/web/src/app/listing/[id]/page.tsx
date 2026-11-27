/**
 * Listing Detail Page
 */

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { ListingDetail } from './ListingDetail';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;
  // In production, fetch listing data for metadata
  return {
    title: 'Property Listing',
    description: 'View property details on Nyumba254: photos, price, location, lister role and viewing fee.',
    openGraph: {
      type: 'website',
      title: 'Nyumba254 Listing',
      description: 'View property details on Nyumba254',
    },
  };
}

export default async function ListingPage({ params }: Props) {
  const { id } = await params;
  return <ListingDetail listingId={id} />;
}