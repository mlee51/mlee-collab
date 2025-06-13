import { useEffect, useState } from "react";

export default function AnimatedText({
  content = "drop files anywhere",
  speed = 150,
  className = "font-mono tracking-wide",
}) {
  const [text, setText] = useState(content);

  useEffect(() => {
    setText(content); // reset when content changes
    const interval = setInterval(() => {
      setText((prev) => prev.slice(1) + prev[0]);
    }, speed);

    return () => clearInterval(interval);
  }, [content, speed]);

  return <div className={className}>{text}</div>;
} 