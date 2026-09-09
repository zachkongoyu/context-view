import { KnowledgeFrame } from "./knowledge-frame";
import "./knowledge.css";
import "./field-guide.css";
import "./agent-lab.css";

export default function LearnLayout({ children }) {
  return <KnowledgeFrame>{children}</KnowledgeFrame>;
}
