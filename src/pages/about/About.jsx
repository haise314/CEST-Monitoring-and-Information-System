import { Link } from 'react-router'
import { useAuth } from '../../lib/AuthContext'
import logo from '../../assets/logo.svg'

const MODES = [
  {
    title: 'In-house',
    paragraphs: [
      "In-house procurement refers to the process of acquiring goods, services, or materials using an organization's internal resources and personnel, rather than outsourcing the procurement process to an external agency or third party.",
      'It means that the organization handles the purchasing process within its own office or department.',
    ],
  },
  {
    title: 'Fund Transfer',
    paragraphs: [
      'Fund transfer refers to allocating funds from one source to another.',
      'Fund transfer usually means the release or transfer of allocated budget from one government office (e.g., a regional office) to another agency, partner institution, or implementing organization to carry out a project or activity.',
    ],
  },
]

const COMPONENTS = [
  'Sustainable Enterprise and Livelihoods',
  'Health and Nutrition',
  'Human Resource Development',
  'DRRM and CCA',
  'Bio-Circular Green Economy Technologies',
  'Digital Governance Tools',
]

const BENEFICIARIES = [
  'GIDA Communities',
  'Communities-in-Conflict',
  "Women's Organizations",
  'Indigenous Peoples',
  'Marginalized Sector',
  'Landless Rural Farmers',
  'Artisanal Fisherfolks',
]

const OUTCOMES = [
  'Human Well-Being Promoted',
  'Wealth Creation Fostered',
  'Wealth Protection Reinforced',
  'Sustainability Institutionalized',
  'Governance Strengthened',
]

const SDGS = [
  [1, 'No Poverty'],
  [2, 'Zero Hunger'],
  [4, 'Quality Education'],
  [6, 'Clean Water and Sanitation'],
  [7, 'Affordable and Clean Energy'],
  [11, 'Sustainable Cities and Communities'],
  [12, 'Responsible Consumption and Production'],
  [16, 'Peace, Justice, and Strong Institutions'],
]

function Section({ title, children }) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 sm:p-6">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{title}</h2>
      {children}
    </section>
  )
}

function Chip({ children }) {
  return (
    <span className="inline-block rounded-full border border-blue-200 bg-blue-50 text-blue-800 text-sm px-3 py-1">
      {children}
    </span>
  )
}

export default function About() {
  const { session } = useAuth()
  const backTo = session ? '/' : '/login'

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
        <Link to={backTo} className="text-sm text-gray-400 hover:text-gray-600">
          ← {session ? 'Back to the app' : 'Back to sign in'}
        </Link>

        <header className="flex items-center gap-4">
          <img src={logo} alt="" className="w-14 h-14 object-contain flex-shrink-0" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">DOST CEST 2.0</h1>
            <p className="text-sm text-gray-500">Implementation of CEST 2.0 Project in Region 3</p>
          </div>
        </header>

        <Section title="Vision">
          <p className="text-lg font-semibold text-gray-800">STI-empowered communities</p>
        </Section>

        <Section title="Goal">
          <p className="text-sm text-gray-700 leading-relaxed">
            A critical mass of resilient, resource-efficient, and gender-responsive communities
            empowered by science, technology, and innovation (STI), laying the foundation for
            their journey to smart and sustainable communities.
          </p>
        </Section>

        <Section title="CEST 2.0 outcomes">
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {OUTCOMES.map((o, i) => (
              <li key={o} className="flex items-center gap-3 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-800">{o}</span>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="How projects are implemented">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {MODES.map(m => (
              <div key={m.title} className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">{m.title}</h3>
                <div className="space-y-2">
                  {m.paragraphs.map(p => (
                    <p key={p} className="text-sm text-gray-600 leading-relaxed">{p}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Components / entry points">
          <ol className="space-y-1.5">
            {COMPONENTS.map((c, i) => (
              <li key={c} className="flex gap-3 text-sm text-gray-800">
                <span className="text-gray-400 w-5 text-right tabular-nums">{i + 1}.</span>
                <span>{c}</span>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Beneficiaries">
          <div className="flex flex-wrap gap-2">
            {BENEFICIARIES.map(b => <Chip key={b}>{b}</Chip>)}
          </div>
        </Section>

        <Section title="Linked Sustainable Development Goals">
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SDGS.map(([n, name]) => (
              <li key={n} className="flex items-center gap-3 text-sm text-gray-800">
                <span className="rounded bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-1 w-16 text-center flex-shrink-0">
                  SDG {n}
                </span>
                {name}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  )
}