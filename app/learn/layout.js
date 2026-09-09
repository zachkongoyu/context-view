import { KnowledgeFrame } from "./knowledge-frame";
import "./knowledge.css";
import "./field-guide.css";

export default function LearnLayout({ children }) {
  return <KnowledgeFrame>{children}</KnowledgeFrame>;
}
