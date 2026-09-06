import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useDocumentTypes() {
  const [documentTypes, setDocumentTypes] = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)

  useEffect(() => {
    async function fetchTypes() {
      const { data, error } = await supabase
        .from('document_types')
        .select('*')
        .order('id')

      if (error) setError(error.message)
      else setDocumentTypes(data ?? [])
      setLoading(false)
    }
    fetchTypes()
  }, [])

  return { documentTypes, loading, error }
}