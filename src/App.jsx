import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

function App() {
  const [status, setStatus] = useState('Connecting...')

  useEffect(() => {
    async function test() {
      const { data, error } = await supabase.from('project_types').select('*')
      if (error) setStatus('Error: ' + error.message)
      else setStatus('Supabase connected!')
    }
    test()
  }, [])

  return (
    <div className="bg-blue-500 text-white p-8 text-2xl">
      {status}
    </div>
  )
}

export default App