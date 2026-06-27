import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Articles from "./pages/Articles";
import Clusters from "./pages/Clusters";
import ClusterDetail from "./pages/ClusterDetail";
import Timeline from "./pages/Timeline";

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Articles />} />
          <Route path="/clusters" element={<Clusters />} />
          <Route path="/clusters/:id" element={<ClusterDetail />} />
          <Route path="/timeline" element={<Timeline />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
