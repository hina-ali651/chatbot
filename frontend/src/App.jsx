import { useState } from "react";

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 16, fontFamily: "system-ui, Segoe UI, Arial" }}>
      <h1 style={{ margin: 0 }}>Frontend</h1>
      <p style={{ opacity: 0.8, marginTop: 8 }}>
        Your Vite entry point expects <code>/src/main.jsx</code>. This restores the missing folder so the app runs again.
      </p>

      <button onClick={() => setCount((c) => c + 1)}>count is {count}</button>
    </div>
  );
}

