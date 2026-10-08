import { useParams } from 'react-router-dom'

export function PublicQuotePage() {
  const { token } = useParams<{ token: string }>()

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Quote</h1>
      <p className="mt-2 text-gray-600">Loading quote {token}… (coming soon)</p>
    </div>
  )
}
