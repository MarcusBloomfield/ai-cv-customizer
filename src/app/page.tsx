"use client";

import { useState } from "react";
// import Image from "next/image"; // No longer used
import { jsPDF, TextOptionsLight } from "jspdf";

export default function Home() {
  const [currentResume, setCurrentResume] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [tailoredResume, setTailoredResume] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resumeCopyButtonText, setResumeCopyButtonText] = useState("Copy Resume");
  const [coverLetterCopyButtonText, setCoverLetterCopyButtonText] = useState("Copy Cover Letter");

  const handleSubmit = async () => {
    setIsLoading(true);
    setTailoredResume("");
    setCoverLetter("");
    console.log("Frontend: Submitting to API");
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/customize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentResume, jobDescription }),
      });
      if (!response.ok) {
        let errorData = { message: "An unknown error occurred." };
        try {
          const result = await response.json();
          errorData.message = result.error || result.details || `API responded with status: ${response.status}`;
        } catch (parseError) {
          errorData.message = `API request failed with status: ${response.status}. Could not parse error response.`;
        }
        console.error("Frontend: API Error -", errorData.message);
        setTailoredResume("Error: Could not generate content. " + errorData.message);
        setCoverLetter("Error: Could not generate content. " + errorData.message);
        throw new Error(errorData.message);
      }
      const data = await response.json();
      console.log("Frontend: Received data from API:", data);
      setTailoredResume(data.tailoredResume || "No resume content received.");
      setCoverLetter(data.coverLetter || "No cover letter content received.");
    } catch (error) {
      console.error("Frontend: Error during API call or processing:", error);
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      if (!tailoredResume) { 
        setTailoredResume("Failed to generate resume: " + errorMessage);
      }
      if (!coverLetter) {
        setCoverLetter("Failed to generate cover letter: " + errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (textToCopy: string, type: 'resume' | 'coverLetter') => {
    if (!navigator.clipboard) {
      if (type === 'resume') setResumeCopyButtonText("Copy Failed");
      else setCoverLetterCopyButtonText("Copy Failed");
      console.warn('Clipboard API not available.');
      setTimeout(() => {
        if (type === 'resume') setResumeCopyButtonText("Copy Resume");
        else setCoverLetterCopyButtonText("Copy Cover Letter");
      }, 2000);
      return;
    }
    try {
      await navigator.clipboard.writeText(textToCopy);
      if (type === 'resume') {
        setResumeCopyButtonText("Copied!");
        console.log('Tailored resume copied to clipboard');
      } else {
        setCoverLetterCopyButtonText("Copied!");
        console.log('Cover letter copied to clipboard');
      }
    } catch (err) {
      if (type === 'resume') setResumeCopyButtonText("Copy Failed");
      else setCoverLetterCopyButtonText("Copy Failed");
      console.error('Failed to copy text: ', err);
    } finally {
      setTimeout(() => {
        if (type === 'resume') setResumeCopyButtonText("Copy Resume");
        else setCoverLetterCopyButtonText("Copy Cover Letter");
      }, 2000);
    }
  };

  const handleDownload = (textToDownload: string, filename: string) => {
    if (!textToDownload) {
      console.warn("No text content to download.");
      return;
    }
    console.log(`Attempting to download ${filename} after pre-processing for TXT.`);

    // Pre-process text for TXT format
    let processedText = textToDownload;
    // Replace --- with a line of dashes
    processedText = processedText.replace(/^---$/gm, '------------------------------------------------------------');
    // Remove ** from bold text (e.g., **text** becomes text)
    processedText = processedText.replace(/\*\*(.*?)\*\*/g, '$1');
    // Optionally, handle other simple markdown like *italic* (remove *)
    // processedText = processedText.replace(/\*(.*?)\*/g, '$1'); 
    // Note: The above would also affect the already processed bold if not careful with order or more specific regex.

    const blob = new Blob([processedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log(`${filename} download initiated.`);
  };

 const handleDownloadPdf = (textToConvert: string, filename: string) => {
    if (!textToConvert) {
      console.warn("No text content to convert to PDF.");
      return;
    }
    console.log(`Attempting to download ${filename} as PDF using jsPDF with basic formatting.`);
    try {
      const pdf = new jsPDF();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      const maxLineWidth = pageWidth - margin * 2;
      let cursorY = margin;
      const lineHeight = 7;
      const boldMarker = "**";
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      const lines = textToConvert.split('\n');
      lines.forEach(line => {
        if (cursorY > pageHeight - margin * 2) {
          pdf.addPage();
          cursorY = margin;
        }
        if (line.trim() === "---") {
          pdf.line(margin, cursorY, pageWidth - margin, cursorY);
          cursorY += lineHeight / 2;
          return;
        }
        let currentX = margin;
        const parts = line.split(boldMarker);
        let isBold = false;
        parts.forEach((part, index) => {
          if (index > 0) isBold = !isBold;
          pdf.setFont("helvetica", isBold ? "bold" : "normal");
          const partLines = pdf.splitTextToSize(part, maxLineWidth - (currentX - margin));
          partLines.forEach((partLine: string, partLineIndex: number) => {
            if (partLineIndex > 0) {
              cursorY += lineHeight;
              currentX = margin;
              if (cursorY > pageHeight - margin * 2) {
                pdf.addPage();
                cursorY = margin;
              }
            }
            const textOptions: TextOptionsLight = {};
            pdf.text(partLine, currentX, cursorY, textOptions);
            currentX += pdf.getStringUnitWidth(partLine) * pdf.getFontSize() / pdf.internal.scaleFactor;
          });
        });
        cursorY += lineHeight;
      });
      pdf.save(filename);
      console.log(`${filename} PDF download initiated.`);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      alert("Failed to generate PDF. See console for details.");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-slate-100 font-[family-name:var(--font-geist-sans)]">
      <header className="w-full bg-slate-800 shadow-lg">
        <div className="container mx-auto px-6 py-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-sky-400">AI CV Customizer</h1>
          <p className="text-slate-300 mt-2 text-lg">Tailor your resume and generate a cover letter with AI.</p>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-6 py-12 w-full max-w-5xl flex flex-col gap-8">
        {/* Input Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="currentResume" className="text-lg font-semibold text-sky-300">
              Your Current Resume
            </label>
            <textarea
              id="currentResume"
              value={currentResume}
              onChange={(e) => setCurrentResume(e.target.value)}
              placeholder="Paste your current resume here..."
              className="w-full h-64 p-3 rounded-md bg-slate-800 border border-slate-700 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none text-slate-200 resize-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="jobDescription" className="text-lg font-semibold text-sky-300">
              Job Description
            </label>
            <textarea
              id="jobDescription"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description here..."
              className="w-full h-64 p-3 rounded-md bg-slate-800 border border-slate-700 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none text-slate-200 resize-none"
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={isLoading || !currentResume || !jobDescription}
          className="w-full sm:w-auto px-6 py-3 rounded-md bg-sky-600 hover:bg-sky-700 text-white font-semibold transition-colors disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed flex items-center justify-center gap-2 self-center"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : (
            "Customize Resume & Generate Cover Letter"
          )}
        </button>

        {/* Output Section */}
        {(tailoredResume || coverLetter) && !isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            {/* Tailored Resume Output */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-sky-300">Tailored Resume</h2>
                {tailoredResume && !isLoading && (
                  <div className="flex gap-2 items-center">
                    <button 
                      onClick={() => handleCopy(tailoredResume, 'resume')}
                      className="p-2 text-sm rounded-md bg-slate-700 hover:bg-slate-600 text-sky-300 transition-colors flex items-center"
                      title="Copy resume to clipboard"
                    >
                      {resumeCopyButtonText === "Copied!" || resumeCopyButtonText === "Copy Failed" ? (
                        resumeCopyButtonText
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-clipboard" viewBox="0 0 16 16">
                          <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                          <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                        </svg>
                      )}
                    </button>
                    <button 
                      onClick={() => handleDownload(tailoredResume, 'tailored_resume.txt')}
                      className="p-2 text-sm rounded-md bg-slate-700 hover:bg-slate-600 text-sky-300 transition-colors flex items-center"
                      title="Download resume as .txt file"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-download" viewBox="0 0 16 16">
                        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                        <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                      </svg>
                      <span className="ml-1">TXT</span>
                    </button>
                    <button 
                      onClick={() => handleDownloadPdf(tailoredResume, 'tailored_resume.pdf')}
                      className="p-2 text-sm rounded-md bg-slate-700 hover:bg-slate-600 text-sky-300 transition-colors flex items-center"
                      title="Download resume as .pdf file"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-download" viewBox="0 0 16 16">
                        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                        <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                      </svg>
                      <span className="ml-1">PDF</span>
                    </button>
                  </div>
                )}
              </div>
              <textarea
                id="tailoredResumeOutput"
                value={tailoredResume}
                onChange={(e) => setTailoredResume(e.target.value)}
                placeholder="Your tailored resume will appear here..."
                className="w-full min-h-[1000px] p-3 rounded-md bg-slate-800 border border-slate-700 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none text-slate-200 resize-none"
                aria-label="Tailored Resume Output"
              />
            </div>

            {/* Cover Letter Output */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-sky-300">Cover Letter</h2>
                {coverLetter && !isLoading && (
                  <div className="flex gap-2 items-center">
                    <button 
                      onClick={() => handleCopy(coverLetter, 'coverLetter')}
                      className="p-2 text-sm rounded-md bg-slate-700 hover:bg-slate-600 text-sky-300 transition-colors flex items-center"
                      title="Copy cover letter to clipboard"
                    >
                     {coverLetterCopyButtonText === "Copied!" || coverLetterCopyButtonText === "Copy Failed" ? (
                        coverLetterCopyButtonText
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-clipboard" viewBox="0 0 16 16">
                          <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                          <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                        </svg>
                      )}
                    </button>
                    <button 
                      onClick={() => handleDownload(coverLetter, 'cover_letter.txt')}
                      className="p-2 text-sm rounded-md bg-slate-700 hover:bg-slate-600 text-sky-300 transition-colors flex items-center"
                      title="Download cover letter as .txt file"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-download" viewBox="0 0 16 16">
                        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                        <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                      </svg>
                      <span className="ml-1">TXT</span>
                    </button>
                    <button 
                      onClick={() => handleDownloadPdf(coverLetter, 'cover_letter.pdf')}
                      className="p-2 text-sm rounded-md bg-slate-700 hover:bg-slate-600 text-sky-300 transition-colors flex items-center"
                      title="Download cover letter as .pdf file"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-download" viewBox="0 0 16 16">
                        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                        <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                      </svg>
                      <span className="ml-1">PDF</span>
                    </button>
                  </div>
                )}
              </div>
              <textarea
                id="coverLetterOutput"
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder="Your generated cover letter will appear here..."
                className="w-full min-h-[1000px] p-3 rounded-md bg-slate-800 border border-slate-700 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none text-slate-200 resize-none"
                aria-label="Cover Letter Output"
              />
            </div>
          </div>
        )}
      </main>

      <footer className="w-full bg-slate-800 border-t border-slate-700 mt-auto">
        <div className="container mx-auto px-6 py-6 text-center text-sm text-slate-400">
          <p>&copy; {new Date().getFullYear()} AI CV Customizer. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
