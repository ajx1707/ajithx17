import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import portfolioData from "./portfolioData.json";
import "./App.css";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

const optionsList = [
  "Summary", "Projects", "Skills", "Technical Skills", "Soft Skills", "Work Experience", "Education", "Certifications", "Contact"
];

function formatPortfolioSection(section, data) {
  switch (section) {
    case "summary":
      return `**Summary:**\n${data.summary}`;
    case "skills":
      return `**Skills:**\n- ${data.skills.join("\n- ")}`;
    case "technicalSkills":
      return `**Technical Skills:**\n- ${data.technicalSkills.join("\n- ")}`;
    case "softSkills":
      return `**Soft Skills:**\n- ${data.softSkills.join("\n- ")}`;
    case "workExperience":
      return (
        `**Work Experience:**\n` +
        data.workExperience.map(exp =>
          `- **${exp.role}**, *${exp.company}* (${exp.date})\n  ${exp.details.map(d => `- ${d}`).join("\n  ")}`
        ).join("\n\n")
      );
    case "projects":
      return (
        `**Projects:**\n` +
        data.projects.map(p =>
          `- **${p.name}**${p.tech ? ` _(Tech: ${p.tech.join(", ")})_` : ""}\n  ${p.description}`
        ).join("\n\n")
      );
    case "education":
      return (
        `**Education:**\n` +
        data.education.map(e =>
          `- **${e.degree}**\n  *${e.college}*\n  CGPA: ${e.cgpa}\n  Duration: ${e.duration}`
        ).join("\n\n")
      );
    case "certifications":
      return `**Certifications:**\n- ${data.certifications.join("\n- ")}`;
    case "contact":
      return (
        `**Contact:**\n` +
        `- Email: [${data.contact.email}](mailto:${data.contact.email})\n` +
        `- Phone: ${data.contact.phone}\n` +
        `- LinkedIn: [${data.contact.linkedin}](${data.contact.linkedin})\n` +
        `- GitHub: [${data.contact.github}](${data.contact.github})`
      );
    default:
      return "";
  }
}

function getSectionKeyFromQuery(query) {
  const q = query.toLowerCase();
  if (q.includes("project")) return "projects";
  if (q.includes("skill") && q.includes("technical")) return "technicalSkills";
  if (q.includes("skill") && q.includes("soft")) return "softSkills";
  if (q.includes("skill")) return "skills";
  if (q.includes("work") || q.includes("intern") || q.includes("experience")) return "workExperience";
  if (q.includes("education") || q.includes("degree") || q.includes("college")) return "education";
  if (q.includes("certification") || q.includes("course")) return "certifications";
  if (q.includes("contact") || q.includes("email") || q.includes("phone") || q.includes("linkedin") || q.includes("github")) return "contact";
  if (q.includes("summary") || q.includes("about")) return "summary";
  return null;
}

// Utility: Find project by name (case-insensitive, partial match)
function findProjectByQuery(query, projects) {
  const q = query.toLowerCase();
  return projects.find(p => p.name.toLowerCase().includes(q));
}

// Utility: Detect if the query is asking for a simple explanation
function isSimpleExplanationQuery(query) {
  const q = query.toLowerCase();
  return (
    q.includes("explain") ||
    q.includes("describe") ||
    q.includes("summary") ||
    q.includes("simple")
  );
}

// Utility: Detect if the query is asking for tech stack
function isTechQuery(query) {
  const q = query.toLowerCase();
  return (
    q.includes("tech") ||
    q.includes("technology") ||
    q.includes("stack") ||
    q.includes("tools")
  );
}

// Utility: Detect if the query is asking for achievements/impact
function isImpactQuery(query) {
  const q = query.toLowerCase();
  return (
    q.includes("impact") ||
    q.includes("achievement") ||
    q.includes("result") ||
    q.includes("award") ||
    q.includes("win")
  );
}

// Utility: Detect if the query is asking for a resume download
function isResumeQuery(query) {
  const q = query.toLowerCase();
  return (
    q.includes("resume") ||
    q.includes("cv") ||
    q.includes("curriculum vitae") ||
    q.includes("download resume")
  );
}

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [theme, setTheme] = useState("dark");
  const messagesEndRef = useRef(null);

  // Quick questions data
  const quickQuestions = [
    {
      text: "Show me your projects",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3h18v18H3zM8 12h8M12 8v8"/>
        </svg>
      )
    },
    {
      text: "What are your skills?",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      )
    },
    {
      text: "Tell me about your AI experience",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 3a9 9 0 0 0-9 9h18a9 9 0 0 0-9-9z"/>
          <path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9z"/>
        </svg>
      )
    },
    {
      text: "Contact info",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
        </svg>
      )
    },
    {
      text: "Education background",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
          <path d="M6 12v5c3 3 9 3 12 0v-5"/>
        </svg>
      )
    },
    {
      text: "Download Resume",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
        </svg>
      )
    }
  ];

  const handleQuickQuestion = (question) => {
    if (!loading) {
      setInput(question);
      handleSend(question);
    }
  };

  // Theme effect
  useEffect(() => {
    if (theme === "light") {
      document.body.classList.add("light-theme");
    } else {
      document.body.classList.remove("light-theme");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // On mount, introduce the AI and show options
  useEffect(() => {
    setMessages([
      {
        role: "ai",
        text:
          `Hello! I am Ajith's personal portfolio assistant.\n\n` +
          `This page is your gateway to learn about Ajith's background, skills, projects, education, and more.\n\n` +
          `You can ask me about any of the following sections:\n` +
          optionsList.map(opt => `- ${opt}`).join("\n") +
          `\n\nFor example, try: "Show me your projects" or "What are your skills?"`
      }
    ]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamedText]);

  const handleSend = async (quickQuestion = null) => {
    const messageText = quickQuestion || input;
    if (!messageText.trim() || loading) return;
    
    const userMessage = { role: "user", text: messageText };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setStreamedText("");

    // Resume download button logic
    if (isResumeQuery(messageText)) {
      const answer = `You can download Ajith R's latest resume below.`;
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: answer, resumeButton: true }
      ]);
      setLoading(false);
      return;
    }

    // Use Llama-3 API for ALL questions with full portfolio context
    // This allows the AI to understand intent and provide contextual responses
    try {
      const apiKey = import.meta.env.VITE_GROQ_API_KEY;
      if (!apiKey) {
        setMessages((prev) => [
          ...prev,
          { role: "ai", text: "[Error: No API key set. Please set VITE_GROQ_API_KEY in your environment.]" },
        ]);
        setLoading(false);
        return;
      }

      // Create context with portfolio data for the AI
      const portfolioContext = `You are Ajith's personal portfolio assistant. Here is Ajith's portfolio information:

**Summary:** ${portfolioData.summary}

**Skills:** ${portfolioData.skills.join(", ")}

**Technical Skills:** ${portfolioData.technicalSkills.join(", ")}

**Soft Skills:** ${portfolioData.softSkills.join(", ")}

**Work Experience:**
${portfolioData.workExperience.map(exp => 
  `- ${exp.role} at ${exp.company} (${exp.date})\n  ${exp.details.join(" ")}`
).join("\n")}

**Projects:**
${portfolioData.projects.map(p => 
  `- ${p.name} (Tech: ${p.tech ? p.tech.join(", ") : "Not specified"})\n  ${p.description}${p.role ? `\n  Role/Impact: ${p.role}` : ""}`
).join("\n\n")}

**Education:**
${portfolioData.education.map(e => 
  `${e.degree} from ${e.college}\nCGPA: ${e.cgpa}\nDuration: ${e.duration}`
).join("\n")}

**Certifications:**
${portfolioData.certifications.join(", ")}

**Contact:**
Email: ${portfolioData.contact.email}
Phone: ${portfolioData.contact.phone}
LinkedIn: ${portfolioData.contact.linkedin}
GitHub: ${portfolioData.contact.github}

IMPORTANT RULES:
1. ONLY answer questions that are directly or indirectly related to Ajith's portfolio, background, skills, projects, experience, education, or contact information.
2. If someone asks a general question (like "what is a black hole", "how to cook pasta", "what's the weather", etc.) that has no connection to Ajith's portfolio, politely decline to answer and redirect them to ask about Ajith's background, skills, projects, or experience.
3. For portfolio-related questions, analyze the user's question carefully and provide contextual, intelligent responses. Don't just list information - understand what they're asking for and provide relevant, detailed answers.
4. Examples of questions you SHOULD answer:
   - "Where has he used his MERN stack skills?"
   - "Tell me about his AI projects"
   - "What are his strongest technical skills?"
   - "Explain the JobConnect Pro project"
   - "What's his work experience?"
   - "How can I contact him?"

5. Examples of questions you should NOT answer:
   - "What is a black hole?"
   - "How to make coffee?"
   - "What's the capital of France?"
   - General technical questions not related to Ajith's work

Always stay focused on Ajith's portfolio and professional background.`;

      const chatHistory = [
        { role: "system", content: portfolioContext },
        ...messages.map((msg) => ({
          role: msg.role === "ai" ? "assistant" : "user",
          content: msg.text,
        })),
        { role: "user", content: messageText }
      ];

      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: chatHistory,
        }),
      });
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      const data = await response.json();
      const aiText = data.choices?.[0]?.message?.content?.trim() || "[No response from AI]";
      // Streaming effect: word by word
      const words = aiText.split(/(\s+)/);
      let i = 0;
      setStreamedText("");
      function streamNext() {
        setStreamedText((prev) => prev + (words[i] || ""));
        i++;
        if (i < words.length) {
          setTimeout(streamNext, 35);
        } else {
          setMessages((prev) => [...prev, { role: "ai", text: aiText }]);
          setStreamedText("");
          setLoading(false);
        }
      }
      streamNext();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: `[Error: ${err.message}]` },
      ]);
      setLoading(false);
      setStreamedText("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSend();
  };

  return (
    <>
      <header className="main-header">
        <div className="header-logo">
          <a href="/" className="monogram" title="Ajith R's Portfolio">
            AJ
          </a>
          <div className="header-title">Ajith R's Portfolio</div>
        </div>
        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          style={{
            marginLeft: "auto",
            marginRight: 24,
            background: "none",
            border: "none",
            cursor: "pointer",
            outline: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            borderRadius: "50%",
            transition: "background 0.2s"
          }}
        >
          {theme === "dark" ? (
            // Sun icon
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffeb3b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" fill="#ffeb3b"/><g stroke="#ffeb3b"><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></g></svg>
          ) : (
            // Moon icon
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#232323" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" fill="#232323"/></svg>
          )}
        </button>
      </header>
      <div className="container">
        <div className="left-panel">
          <div className="profile-container">
            <div className="profile-glow">
              <img
                className="profile-img"
                src="/IMG_20250708_114543.jpg"
                alt="Ajith Kumar"
                style={{ cursor: 'pointer' }}
                onClick={() => setShowProfileModal(true)}
              />
            </div>
            <div className="profile-details">
              <div className="profile-name">Ajith R</div>
              <div className="profile-role">Full-Stack Web Developer</div>
              <div className="profile-meta">Chennai, India</div>
            </div>
          </div>
          
          <div className="bio-section">
            <div className="bio-title">About Me</div>
            <div className="bio-text">
              {portfolioData.summary}
            </div>
          </div>

          <div className="social-section">
            <div className="social-title">Connect with me</div>
            <div className="social-links">
              <a href={portfolioData.contact.github} target="_blank" rel="noopener noreferrer" title="GitHub">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </a>
              <a href={portfolioData.contact.linkedin} target="_blank" rel="noopener noreferrer" title="LinkedIn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
              <a
                href={`https://mail.google.com/mail/?view=cm&fs=1&to=${portfolioData.contact.email}`}
                title="Email"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M0 3v18h24V3H0zm21.518 2L12 12.713 2.482 5h19.036zM2 19V7.183l10 8.104 10-8.104V19H2z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      <div className="right-panel">
        <div className="chat-area">
          <div className="messages">
            {messages.map((msg, idx) => (
              msg.role === "ai" ? (
                <div
                  key={idx}
                  className="message-row ai-row"
                  style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', marginBottom: '0.5em' }}
                >
                  <span className="ai-avatar" style={{ marginRight: 12, marginTop: 2 }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" fill="#232323" stroke="#4caf50" strokeWidth="2" />
                      <rect x="7" y="9" width="10" height="6" rx="3" fill="#4caf50" />
                      <circle cx="9" cy="12" r="1" fill="#232323" />
                      <circle cx="15" cy="12" r="1" fill="#232323" />
                      <rect x="11" y="5" width="2" height="3" rx="1" fill="#4caf50" />
                    </svg>
                  </span>
                  <div className="message ai-message">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                    {msg.resumeButton && (
                      <a
                        href="/ajith - resume.pdf"
                        download
                        className="resume-download-btn"
                        style={{ display: 'inline-block', marginTop: 16 }}
                      >
                        Download Resume
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  key={idx}
                  className="message-row user-row"
                  style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', marginBottom: '0.5em', width: '100%' }}
                >
                  <div className="message user-message">
                    {msg.text}
                  </div>
                </div>
              )
            ))}
            {loading && streamedText && (
              <div className="message-row ai-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', marginBottom: '0.5em' }}>
                <span className="ai-avatar" style={{ marginRight: 12, marginTop: 2 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" fill="#232323" stroke="#4caf50" strokeWidth="2" />
                    <rect x="7" y="9" width="10" height="6" rx="3" fill="#4caf50" />
                    <circle cx="9" cy="12" r="1" fill="#232323" />
                    <circle cx="15" cy="12" r="1" fill="#232323" />
                    <rect x="11" y="5" width="2" height="3" rx="1" fill="#4caf50" />
                  </svg>
                </span>
                <div className="message ai-message">
                  <ReactMarkdown>{streamedText}</ReactMarkdown>
                </div>
              </div>
            )}
            {loading && !streamedText && (
              <div className="message-row ai-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', marginBottom: '0.5em' }}>
                <span className="ai-avatar" style={{ marginRight: 12, marginTop: 2 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" fill="#232323" stroke="#4caf50" strokeWidth="2" />
                    <rect x="7" y="9" width="10" height="6" rx="3" fill="#4caf50" />
                    <circle cx="9" cy="12" r="1" fill="#232323" />
                    <circle cx="15" cy="12" r="1" fill="#232323" />
                    <rect x="11" y="5" width="2" height="3" rx="1" fill="#4caf50" />
                  </svg>
                </span>
                <div className="message ai-message">Thinking...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="input-bar">
            <input
              type="text"
              placeholder={loading ? "Wait for response..." : "Type a message..."}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button title="Send" onClick={() => handleSend()} disabled={loading}>&#8593;</button>
          </div>
          <div className="quick-questions">
            {quickQuestions.map((q, idx) => (
              <button
                key={idx}
                className="quick-question-btn"
                onClick={() => handleQuickQuestion(q.text)}
                disabled={loading}
              >
                {q.icon}
                {q.text}
              </button>
            ))}
          </div>
        </div>
      </div>
      </div>
      {showProfileModal && (
        <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <img
              src="/IMG_20250708_114543.jpg"
              alt="Ajith Kumar Large"
              className="modal-profile-img"
            />
            <button className="modal-close" onClick={() => setShowProfileModal(false)}>&times;</button>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
