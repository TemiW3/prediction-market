import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { CreateMarketPage } from "./pages/CreateMarketPage";
import { HomePage } from "./pages/HomePage";
import { MarketDetailPage } from "./pages/MarketDetailPage";
import { PortfolioPage } from "./pages/PortfolioPage";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<CreateMarketPage />} />
        <Route path="/markets/:gameKey" element={<MarketDetailPage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
