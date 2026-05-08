import MapClient from './MapClient'

export default async function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <MapClient projectId={id} />
}
