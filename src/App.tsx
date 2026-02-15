import { Routes, Route } from "react-router-dom";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<div>BirthBuild</div>} />
      <Route path="*" element={<div>Page not found</div>} />
    </Routes>
  );
}
