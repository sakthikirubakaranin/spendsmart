import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function Layout({ children, title, filterMode, onFilterModeChange, onDataChanged }) {
  return (
    <div className="flex min-h-screen dot-grid" style={{ background: '#07070f' }}>
      <Sidebar />
      <div className="flex-1 ml-[220px] flex flex-col min-h-screen">
        <TopBar title={title} filterMode={filterMode} onFilterModeChange={onFilterModeChange} onDataChanged={onDataChanged} />
        <main className="flex-1 px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  )
}
