import BoardPage from './BoardPage'
import CreatePage from './CreatePage'

export default function App() {
  const match = location.pathname.match(/^\/board\/([a-f0-9]{32})$/)
  return match ? <BoardPage roomId={match[1]} /> : <CreatePage />
}