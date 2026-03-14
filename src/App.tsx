/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Moon, Sun, User, Medal, Lightbulb, Users, UploadCloud, 
  FileText, CheckCircle, MessageSquare, Copy, Eye, Download, Info, Save, Trash2, X,
  TableProperties, Loader2, RotateCcw
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";

const GRADES = ["Lớp 1", "Lớp 2", "Lớp 3", "Lớp 4", "Lớp 5"];
const SUBJECTS = [
  "Toán", "Tiếng Việt", "Tiếng Anh", "Tự nhiên và Xã hội", 
  "Khoa học", "Lịch sử & Địa lí", "Âm nhạc", "Mĩ thuật", 
  "Tin học", "Giáo dục thể chất", "Công nghệ", "Đạo đức", 
  "Hoạt động trải nghiệm", "Leader in Me"
];

interface StudentResult {
  id: number;
  studentName: string;
  level: string;
  achievement: string;
  limitation: string;
  parentSupport: string;
}

interface ImportedStudent {
  name: string;
  level: string;
  note: string;
}

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState('input');
  
  // States cho form
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isKeySaved, setIsKeySaved] = useState(false);
  const [showKeyGuide, setShowKeyGuide] = useState(false);
  
  // Load API Key từ localStorage khi khởi tạo
  useEffect(() => {
    const savedKey = localStorage.getItem('educomment_api_key');
    if (savedKey) {
      setApiKeyInput(savedKey);
      setIsKeySaved(true);
    }
  }, []);

  const saveApiKey = () => {
    if (apiKeyInput.trim()) {
      localStorage.setItem('educomment_api_key', apiKeyInput.trim());
      setIsKeySaved(true);
    }
  };

  const deleteApiKey = () => {
    localStorage.removeItem('educomment_api_key');
    setApiKeyInput("");
    setIsKeySaved(false);
  };
  
  const [studentNames, setStudentNames] = useState("");
  const [yccd, setYccd] = useState("");
  const [grade, setGrade] = useState("Lớp 1");
  const [subject, setSubject] = useState("Toán");
  
  // States cho tính năng File Import
  const [importedData, setImportedData] = useState<ImportedStudent[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States xử lý dữ liệu
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<StudentResult[]>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Toggle Dark Mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Tải file mẫu CSV
  const downloadTemplate = () => {
    const csvContent = '\uFEFFHọ và tên;Mức độ;Ghi chú\nNguyễn Văn A;Hoàn thành tốt;Rất thông minh nhưng hay nói chuyện riêng\nTrần Thị B;Hoàn thành;Cần rèn thêm chữ viết\nLê Văn C;Chưa hoàn thành;Chưa thuộc bảng cửu chương';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Mau_Danh_Sach_Hoc_Sinh.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Xử lý khi upload file CSV
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = text.split('\n');
      const parsedData: ImportedStudent[] = [];

      let startIdx = 0;
      if (rows[0].trim().startsWith('sep=')) startIdx = 1;
      
      const headerRow = rows[startIdx] || "";
      const delimiter = headerRow.includes(';') ? ';' : ',';
      startIdx++;

      for (let i = startIdx; i < rows.length; i++) {
        const row = rows[i].trim();
        if (!row) continue;

        const cols: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let char of row) {
          if (char === '"') inQuotes = !inQuotes;
          else if (char === delimiter && !inQuotes) { 
            cols.push(current.trim().replace(/^"|"$/g, '')); 
            current = ''; 
          }
          else current += char;
        }
        cols.push(current.trim().replace(/^"|"$/g, ''));

        if (cols.length >= 1 && cols[0]) {
          parsedData.push({
            name: cols[0],
            level: cols[1] || 'Hoàn thành',
            note: cols[2] || ''
          });
        }
      }

      if (parsedData.length > 0) {
        setImportedData(parsedData);
      } else {
        alert("File không có dữ liệu hợp lệ.");
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  // Gọi AI sử dụng Gemini hoặc Groq làm fallback
  const generateAI = async (studentName: string, level: string, note: string = '', userApiKey: string = '') => {
    const apiKey = userApiKey || process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY;
    
    if (!apiKey) {
      throw new Error("Hệ thống chưa sẵn sàng. Vui lòng nhập API Key (Gemini hoặc Groq) ở ô 'API Configuration' hoặc kiểm tra lại Secrets panel.");
    }

    const noteInstruction = note ? `\nGHI CHÚ ĐẶC BIỆT TỪ GIÁO VIÊN: "${note}". Hãy lồng ghép ý này vào nhận xét.` : '';
    
    // Tinh chỉnh prompt để bám sát mức độ và xưng hô
    const promptText = `
      Bạn là chuyên gia giáo dục tiểu học tại Việt Nam. Hãy viết nhận xét đánh giá cuối kỳ bám sát THÔNG TƯ 27/2020/TT-BGDĐT.
      Môn: ${subject}. Khối: ${grade}.
      Yêu cầu cần đạt (YCCĐ): ${yccd || 'Hoàn thành chương trình môn học'}.
      Mức độ đạt được của học sinh: ${level}.
      ${noteInstruction}

      QUY TẮC XƯNG HÔ & NỘI DUNG (TUYỆT ĐỐI TUÂN THỦ):
      1. XƯNG HÔ: Chỉ sử dụng đại từ "Em" để gọi học sinh. 
      2. KHÔNG DÙNG TÊN: TUYỆT ĐỐI KHÔNG ghi tên học sinh (ví dụ: "Nguyễn Văn A", "An", "Bình",...) trong nội dung nhận xét. Thay tất cả bằng "Em".
      3. PHÂN BIỆT MỨC ĐỘ:
         - Nếu mức độ là "Hoàn thành tốt": Sử dụng các từ ngữ khen ngợi như "tốt", "xuất sắc", "thông minh", "nổi bật".
         - Nếu mức độ là "Hoàn thành": Chỉ nhận xét là em đã đạt được YCCĐ, nắm vững kiến thức cơ bản. TUYỆT ĐỐI KHÔNG dùng từ "tốt", "giỏi" hay "xuất sắc". Hãy dùng các từ như "đạt yêu cầu", "có cố gắng", "nắm được bài".
         - Nếu mức độ là "Chưa hoàn thành": Tập trung vào việc em cần cố gắng hơn, chỉ ra các lỗ hổng kiến thức một cách nhẹ nhàng nhưng rõ ràng. TUYỆT ĐỐI KHÔNG dùng từ ngữ tích cực quá mức.
      4. CẤU TRÚC TRẢ VỀ: JSON với 3 trường: "achievement", "limitation", "parentSupport".

      YÊU CẦU CHI TIẾT THEO THÔNG TƯ 27:
      - Thành tích: Nhận xét sự hình thành năng lực, phẩm chất dựa trên YCCĐ.
      - Hạn chế: Chỉ ra nội dung chưa đạt hoặc cần rèn luyện thêm.
      - Lời khuyên: Hướng dẫn phụ huynh phối hợp.

      Ngôn ngữ: Tiếng Việt, sư phạm, chuẩn xác theo mức độ.
    `;

    // Hàm gọi Gemini
    const callGemini = async (key: string) => {
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: promptText }] }],
        config: { responseMimeType: "application/json", temperature: 0.7 }
      });
      return JSON.parse(response.text || "{}");
    };

    // Hàm gọi Groq
    const callGroq = async (key: string) => {
      const groq = new Groq({ apiKey: key, dangerouslyAllowBrowser: true });
      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: "user", content: promptText }],
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
        temperature: 0.7,
      });
      return JSON.parse(chatCompletion.choices[0]?.message?.content || "{}");
    };

    try {
      let parsed: any = {};
      
      // Nếu key bắt đầu bằng gsk_ thì dùng Groq ngay
      if (apiKey.startsWith('gsk_')) {
        parsed = await callGroq(apiKey);
      } else {
        try {
          // Thử Gemini trước
          parsed = await callGemini(apiKey);
        } catch (geminiError) {
          console.warn("Gemini failed, checking for Groq fallback...", geminiError);
          // Nếu Gemini lỗi và có Groq key trong env thì thử Groq
          if (process.env.GROQ_API_KEY) {
            parsed = await callGroq(process.env.GROQ_API_KEY);
          } else {
            throw geminiError;
          }
        }
      }

      // Hậu xử lý: Đảm bảo không có tên học sinh trong nhận xét
      const cleanText = (text: string) => {
        if (!text) return "";
        let cleaned = text;
        // Thay thế tên học sinh (nếu AI lỡ ghi vào) bằng "Em"
        const nameParts = studentName.split(' ').filter(p => p.length > 0);
        nameParts.forEach(part => {
          const regex = new RegExp(`\\b${part}\\b`, 'gi');
          cleaned = cleaned.replace(regex, 'Em');
        });
        // Thay thế các cụm từ xưng hô đầy đủ nếu có
        cleaned = cleaned.replace(new RegExp(studentName, 'gi'), 'Em');
        // Viết hoa chữ cái đầu nếu cần
        cleaned = cleaned.replace(/Em em/g, 'Em');
        cleaned = cleaned.trim();
        return cleaned;
      };

      return { 
        id: Date.now() + Math.random(), 
        studentName, 
        level, 
        achievement: cleanText(parsed.achievement) || "Chưa có nội dung thành tích.", 
        limitation: cleanText(parsed.limitation) || "Chưa có nội dung hạn chế.", 
        parentSupport: cleanText(parsed.parentSupport) || "Chưa có lời khuyên phụ huynh." 
      };
    } catch (e: any) {
      console.error("API Error:", e);
      let errorMsg = "Lỗi kết nối API.";
      if (e.message?.includes("403")) errorMsg = "API Key không hợp lệ hoặc hết hạn.";
      if (e.message?.includes("429")) errorMsg = "Hệ thống đang bận (Quá tải). Vui lòng thử lại sau giây lát.";
      
      return { 
        id: Date.now() + Math.random(), 
        studentName, 
        level, 
        achievement: `[Lỗi] ${errorMsg}`, 
        limitation: "Vui lòng kiểm tra lại cấu hình API Key.", 
        parentSupport: "Đảm bảo kết nối mạng ổn định." 
      };
    }
  };

  const handleGenerate = async (manualLevel: string | null = null) => {
    setIsGenerating(true);
    let newResults: StudentResult[] = [];

    try {
      // Lấy key đang hoạt động (ưu tiên key đã lưu ở UI)
      const activeKey = isKeySaved ? apiKeyInput : '';

      if (importedData && importedData.length > 0) {
        for (let student of importedData) {
          const res = await generateAI(student.name, student.level, student.note, activeKey);
          newResults.push(res);
        }
      } else {
        if (!studentNames.trim()) {
          alert("Vui lòng nhập tên học sinh hoặc nạp file!");
          setIsGenerating(false);
          return;
        }
        const names = studentNames.split('\n').map(n => n.trim()).filter(n => n);
        for (let name of names) {
          const res = await generateAI(name, manualLevel || "Hoàn thành", '', activeKey);
          newResults.push(res);
        }
      }

      setResults(prev => [...newResults, ...prev]);
      setActiveTab('achievement');
    } catch (error) {
      alert(error instanceof Error ? error.message : "Đã có lỗi xảy ra");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const [refreshingId, setRefreshingId] = useState<number | null>(null);

  const handleRefresh = async (result: StudentResult) => {
    setRefreshingId(result.id);
    try {
      const activeKey = isKeySaved ? apiKeyInput : '';
      // Tìm note gốc nếu có từ importedData
      const originalNote = importedData?.find(s => s.name === result.studentName)?.note || '';
      const newRes = await generateAI(result.studentName, result.level, originalNote, activeKey);
      
      setResults(prev => prev.map(r => r.id === result.id ? { ...newRes, id: result.id } : r));
    } catch (error) {
      alert("Không thể làm mới nhận xét: " + (error instanceof Error ? error.message : "Lỗi không xác định"));
    } finally {
      setRefreshingId(null);
    }
  };

  const exportExcel = () => {
    if (results.length === 0) return;
    // Header với đầy đủ các cột
    let csvContent = '\uFEFFSTT;Họ và tên;Mức độ;Thành tích;Hạn chế;Lời khuyên phụ huynh\n';
    results.forEach((r, index) => {
      const esc = (str: string) => `"${(str || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;
      csvContent += `${index + 1};${esc(r.studentName)};${esc(r.level)};${esc(r.achievement)};${esc(r.limitation)};${esc(r.parentSupport)}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Danh_Sach_Nhan_Xet_${subject}_${grade}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Dark Mode Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <button 
          onClick={() => setDarkMode(!darkMode)}
          className={`p-2 rounded-full shadow-lg transition-all hover:scale-110 ${darkMode ? 'bg-slate-800 text-yellow-400' : 'bg-white text-slate-600'}`}
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      {/* Header */}
      <header className="pt-12 pb-8 px-4 text-center max-w-4xl mx-auto">
        <div className="flex flex-col items-center gap-4">
          <div className="p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-500/20">
            <MessageSquare size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight">EduComment Pro</h1>
            <p className={`mt-2 text-lg ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Trợ lý AI viết nhận xét học sinh theo Thông tư 27
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pb-20">
        
        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <TabButton 
            active={activeTab === 'input'} 
            onClick={() => setActiveTab('input')} 
            icon={<User size={20}/>} 
            title="Nhập liệu" 
            sub="Tên học sinh" 
            darkMode={darkMode} 
            color="blue" 
          />
          <TabButton 
            active={activeTab === 'achievement'} 
            onClick={() => setActiveTab('achievement')} 
            icon={<Medal size={20}/>} 
            title="Thành tích" 
            sub="Năng lực & Phẩm chất" 
            darkMode={darkMode} 
            color="emerald" 
          />
          <TabButton 
            active={activeTab === 'limitation'} 
            onClick={() => setActiveTab('limitation')} 
            icon={<Lightbulb size={20}/>} 
            title="Hạn chế" 
            sub="Cần khắc phục" 
            darkMode={darkMode} 
            color="orange" 
          />
          <TabButton 
            active={activeTab === 'parent'} 
            onClick={() => setActiveTab('parent')} 
            icon={<Users size={20}/>} 
            title="Phụ huynh" 
            sub="Phối hợp rèn luyện" 
            darkMode={darkMode} 
            color="violet" 
          />
        </div>

        <div className={`rounded-2xl shadow-xl border overflow-hidden ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          
          {activeTab === 'input' && (
            <div className="p-8">
              {/* API Key Form Upgrade */}
              <div className={`mb-8 p-5 rounded-2xl border transition-all ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2 font-bold text-sm uppercase tracking-wider text-slate-500">
                    <Save size={16} /> API Configuration:
                  </div>
                  <div className="flex-1 flex items-center gap-3">
                    <input 
                      type="password" 
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="Nhập Gemini Key (AIza...) hoặc Groq Key (gsk_)..."
                      disabled={isKeySaved}
                      className={`flex-1 px-4 py-2 rounded-xl border-2 outline-none transition-all text-sm ${
                        darkMode ? 'bg-slate-800 border-slate-700 focus:border-blue-500' : 'bg-white border-slate-200 focus:border-blue-500'
                      }`}
                    />
                    {!isKeySaved ? (
                      <button 
                        onClick={saveApiKey}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20"
                      >
                        Lưu Key
                      </button>
                    ) : (
                      <button 
                        onClick={deleteApiKey}
                        className="px-4 py-2 bg-red-100 text-red-600 hover:bg-red-200 text-sm font-bold rounded-xl transition-all"
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                  <button 
                    onClick={() => setShowKeyGuide(!showKeyGuide)}
                    className="text-blue-500 text-xs font-bold hover:underline flex items-center gap-1"
                  >
                    <Info size={14} /> Hướng dẫn
                  </button>
                </div>
                {showKeyGuide && (
                  <div className={`mt-4 p-5 rounded-2xl text-xs leading-relaxed border ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-blue-50 border-blue-100 text-blue-900'}`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="font-bold mb-3 flex items-center gap-2 text-sm">
                          <span className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px]">1</span>
                          Cách lấy Groq API Key (Khuyên dùng - Rất nhanh):
                        </p>
                        <ol className="list-decimal ml-5 space-y-2">
                          <li>Truy cập: <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-blue-500 underline font-bold">console.groq.com/keys</a></li>
                          <li>Đăng nhập bằng tài khoản Google của bạn.</li>
                          <li>Nhấn nút <b>"Create API Key"</b>.</li>
                          <li>Đặt tên (ví dụ: "EduComment") và nhấn <b>"Submit"</b>.</li>
                          <li>Sao chép mã bắt đầu bằng <code>gsk_...</code> và dán vào ô nhập liệu phía trên.</li>
                        </ol>
                      </div>
                      <div>
                        <p className="font-bold mb-3 flex items-center gap-2 text-sm">
                          <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px]">2</span>
                          Cách lấy Gemini API Key:
                        </p>
                        <ol className="list-decimal ml-5 space-y-2">
                          <li>Truy cập: <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-500 underline font-bold">aistudio.google.com</a></li>
                          <li>Đăng nhập tài khoản Google.</li>
                          <li>Nhấn <b>"Create API key"</b>.</li>
                          <li>Chọn dự án và nhấn <b>"Create API key in existing project"</b>.</li>
                          <li>Sao chép mã bắt đầu bằng <code>AIza...</code> và dán vào ô nhập liệu.</li>
                        </ol>
                      </div>
                    </div>
                    <div className={`mt-4 pt-4 border-t ${darkMode ? 'border-slate-800' : 'border-blue-100'} italic`}>
                      * Lưu ý: Hệ thống sẽ tự động nhận diện loại Key bạn nhập. Groq thường cho tốc độ phản hồi nhanh hơn và ít bị giới hạn hơn đối với người dùng Việt Nam.
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                
                {/* Left Column: Students */}
                <div className="space-y-6">
                  <div>
                    <label className="flex items-center justify-between mb-3">
                      <span className="font-semibold flex items-center gap-2">
                        Danh sách học sinh <span className="text-red-500">*</span>
                      </span>
                    </label>
                    
                    <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />

                    {!importedData ? (
                      <div className="relative">
                        <textarea 
                          value={studentNames}
                          onChange={(e) => setStudentNames(e.target.value)}
                          placeholder="Nhập thủ công: Mỗi dòng 1 tên học sinh..."
                          className={`w-full h-48 p-4 rounded-xl border-2 transition-all outline-none text-sm ${
                            darkMode 
                            ? 'bg-slate-800 border-slate-700 focus:border-blue-500' 
                            : 'bg-slate-50 border-slate-200 focus:border-blue-500'
                          }`}
                        />
                      </div>
                    ) : (
                      <div className={`w-full h-48 border-2 rounded-xl overflow-hidden flex flex-col ${darkMode ? 'border-slate-700 bg-slate-950' : 'border-slate-200 bg-slate-50'}`}>
                        <div className="px-4 py-2 bg-blue-600 text-white flex justify-between items-center text-sm font-medium">
                          <span className="flex items-center gap-2"><TableProperties size={16}/> Đã nạp {importedData.length} học sinh</span>
                          <button onClick={() => setImportedData(null)} className="hover:text-red-200"><X size={18}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                          <table className="w-full text-xs text-left">
                            <thead className={`sticky top-0 ${darkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                              <tr>
                                <th className="px-3 py-2">Họ và tên</th>
                                <th className="px-3 py-2">Mức độ</th>
                                <th className="px-3 py-2">Ghi chú</th>
                              </tr>
                            </thead>
                            <tbody>
                              {importedData.map((s, i) => (
                                <tr key={i} className={`border-b last:border-0 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                                  <td className="px-3 py-2 font-medium">{s.name}</td>
                                  <td className="px-3 py-2">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                      s.level.includes('tốt') ? 'bg-emerald-100 text-emerald-700' : 
                                      s.level.includes('Chưa') ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                                    }`}>
                                      {s.level}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 truncate max-w-[120px] italic text-slate-500">{s.note}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex flex-wrap gap-3 mt-4">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20"
                      >
                        <UploadCloud size={18} /> Nạp từ File CSV
                      </button>
                      <button 
                        onClick={downloadTemplate}
                        className={`px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all border-2 ${
                          darkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Download size={18} /> File mẫu
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column: Settings */}
                <div className="space-y-6">
                  <div>
                    <label className="block font-semibold mb-3">Nội dung Yêu cầu cần đạt (YCCĐ)</label>
                    <textarea 
                      value={yccd}
                      onChange={(e) => setYccd(e.target.value)}
                      placeholder="VD: Biết thực hiện phép cộng trong phạm vi 100, giải toán có lời văn..."
                      className={`w-full h-32 p-4 rounded-xl border-2 transition-all outline-none text-sm ${
                        darkMode 
                        ? 'bg-slate-800 border-slate-700 focus:border-blue-500' 
                        : 'bg-slate-50 border-slate-200 focus:border-blue-500'
                      }`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2">Khối lớp</label>
                      <select 
                        value={grade} 
                        onChange={(e)=>setGrade(e.target.value)} 
                        className={`w-full p-3 rounded-xl border-2 outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                      >
                        {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-2">Môn học</label>
                      <select 
                        value={subject} 
                        onChange={(e)=>setSubject(e.target.value)} 
                        className={`w-full p-3 rounded-xl border-2 outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                      >
                        {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Generate Buttons */}
              <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800">
                {isGenerating ? (
                  <div className="flex flex-col items-center gap-4 py-4">
                    <Loader2 className="animate-spin text-blue-600" size={48} />
                    <p className="font-bold text-xl animate-pulse">AI đang soạn thảo nhận xét...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {importedData ? (
                      <button 
                        onClick={() => handleGenerate()}
                        className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xl rounded-2xl shadow-2xl shadow-blue-500/30 transition-all hover:-translate-y-1 active:translate-y-0"
                      >
                        Bắt đầu tạo nhận xét cho {importedData.length} học sinh
                      </button>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <LevelButton 
                          onClick={() => handleGenerate("Hoàn thành tốt")} 
                          label="Hoàn thành tốt" 
                          color="emerald" 
                        />
                        <LevelButton 
                          onClick={() => handleGenerate("Hoàn thành")} 
                          label="Hoàn thành" 
                          color="blue" 
                        />
                        <LevelButton 
                          onClick={() => handleGenerate("Chưa hoàn thành")} 
                          label="Chưa hoàn thành" 
                          color="orange" 
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Result Tabs */}
          {['achievement', 'limitation', 'parent'].includes(activeTab) && (
            <div className="flex flex-col min-h-[600px]">
              <div className={`p-6 border-b flex items-center justify-between ${
                activeTab === 'achievement' ? 'bg-emerald-500/5' :
                activeTab === 'limitation' ? 'bg-orange-500/5' : 'bg-violet-500/5'
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${
                    activeTab === 'achievement' ? 'bg-emerald-500 text-white' :
                    activeTab === 'limitation' ? 'bg-orange-500 text-white' : 'bg-violet-500 text-white'
                  }`}>
                    {activeTab === 'achievement' ? <Medal size={24}/> : 
                     activeTab === 'limitation' ? <Lightbulb size={24}/> : <Users size={24}/>}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">
                      {activeTab === 'achievement' ? 'Thành tích đạt được' : 
                       activeTab === 'limitation' ? 'Hạn chế & Định hướng' : 'Lời nhắn gửi phụ huynh'}
                    </h2>
                    <p className="text-slate-500 text-sm">Kết quả nhận xét cá nhân hóa từ AI</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      if (window.confirm("Bạn có chắc chắn muốn làm mới toàn bộ nhận xét?")) {
                        results.forEach(res => handleRefresh(res));
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-xl transition-all font-medium text-sm"
                    title="Làm mới tất cả"
                  >
                    <RotateCcw size={16} className={refreshingId !== null ? 'animate-spin' : ''} />
                    Làm mới tất cả
                  </button>
                  <button onClick={() => setShowPreviewModal(true)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                    <Eye size={20} />
                  </button>
                  <button onClick={exportExcel} className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors">
                    <Download size={20} />
                  </button>
                </div>
              </div>

              <div className="p-8 flex-1 space-y-6 overflow-y-auto max-h-[700px]">
                {results.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 italic">
                    <MessageSquare size={48} className="mb-4 opacity-20" />
                    <p>Chưa có nhận xét nào được tạo.</p>
                  </div>
                ) : (
                  results.map((res) => (
                    <div key={res.id} className={`p-6 rounded-2xl border-2 transition-all hover:shadow-lg ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-bold">{res.studentName}</h3>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                            res.level.includes('tốt') ? 'bg-emerald-100 text-emerald-700' : 
                            res.level.includes('Chưa') ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {res.level}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => handleRefresh(res)}
                            disabled={refreshingId === res.id}
                            className={`flex items-center gap-1 px-3 py-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg text-slate-400 hover:text-emerald-600 transition-all border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800 ${refreshingId === res.id ? 'text-emerald-500' : ''}`}
                            title="Làm mới nhận xét này"
                          >
                            <RotateCcw size={16} className={refreshingId === res.id ? 'animate-spin' : ''}/>
                            <span className="text-xs font-medium">Làm mới</span>
                          </button>
                          <button 
                            onClick={() => copyToClipboard(
                              activeTab === 'achievement' ? res.achievement : 
                              activeTab === 'limitation' ? res.limitation : res.parentSupport
                            )}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-blue-500 transition-all"
                            title="Sao chép"
                          >
                            <Copy size={18}/>
                          </button>
                        </div>
                      </div>
                      <p className="text-lg leading-relaxed">
                        {activeTab === 'achievement' ? res.achievement : 
                         activeTab === 'limitation' ? res.limitation : res.parentSupport}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex justify-end gap-4">
                <button 
                  onClick={() => {
                    const allText = results.map(r => 
                      activeTab === 'achievement' ? r.achievement : 
                      activeTab === 'limitation' ? r.limitation : r.parentSupport
                    ).join('\n\n');
                    copyToClipboard(allText);
                  }}
                  className="px-6 py-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl font-bold transition-all"
                >
                  Sao chép tất cả
                </button>
                <button 
                  onClick={exportExcel}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                >
                  <Download size={20} />
                  Tải xuống danh sách đầy đủ
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className={`w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[85vh] ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-2xl font-bold">Xem trước nhận xét</h3>
              <button onClick={() => setShowPreviewModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <X size={24}/>
              </button>
            </div>
            <div className="p-8 overflow-y-auto space-y-6">
              {results.map((res, idx) => (
                <div key={idx} className={`p-6 rounded-2xl border-2 ${darkMode ? 'border-slate-800 bg-slate-950' : 'border-slate-100 bg-slate-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-lg">{res.studentName}</span>
                    <span className="text-slate-400 text-sm">• {res.level}</span>
                  </div>
                  <div className="space-y-4 text-sm">
                    <div>
                      <span className="font-bold text-emerald-600 uppercase text-[10px] tracking-wider">Thành tích:</span>
                      <p className="mt-1">{res.achievement}</p>
                    </div>
                    <div>
                      <span className="font-bold text-orange-600 uppercase text-[10px] tracking-wider">Hạn chế:</span>
                      <p className="mt-1">{res.limitation}</p>
                    </div>
                    <div>
                      <span className="font-bold text-violet-600 uppercase text-[10px] tracking-wider">Phụ huynh:</span>
                      <p className="mt-1">{res.parentSupport}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <footer className="py-12 text-center border-t border-slate-200 dark:border-slate-800">
        <p className="text-slate-500 font-medium">
          EduComment Pro &copy; 2026 • Developed by <span className="text-blue-600">Chung Văn Nam</span>
        </p>
      </footer>
    </div>
  );
}

function TabButton({ active, onClick, icon, title, sub, darkMode, color }: any) {
  const colors: any = {
    blue: active ? 'bg-blue-600 text-white shadow-blue-500/20' : (darkMode ? 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'),
    emerald: active ? 'bg-emerald-600 text-white shadow-emerald-500/20' : (darkMode ? 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'),
    orange: active ? 'bg-orange-600 text-white shadow-orange-500/20' : (darkMode ? 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'),
    violet: active ? 'bg-violet-600 text-white shadow-violet-500/20' : (darkMode ? 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'),
  };

  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-300 ${colors[color]} ${active ? 'border-transparent shadow-xl scale-105' : 'border-slate-200 dark:border-slate-800'}`}
    >
      <div className={`mb-2 transition-transform duration-300 ${active ? 'scale-110' : ''}`}>{icon}</div>
      <span className="font-bold text-sm tracking-tight">{title}</span>
      <span className={`text-[10px] font-medium opacity-70 mt-0.5 hidden sm:block uppercase tracking-widest`}>{sub}</span>
    </button>
  );
}

function LevelButton({ onClick, label, color }: any) {
  const colors: any = {
    emerald: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20',
    blue: 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20',
    orange: 'bg-orange-600 hover:bg-orange-700 shadow-orange-500/20',
  };

  return (
    <button 
      onClick={onClick}
      className={`py-4 px-6 text-white font-bold rounded-2xl shadow-lg transition-all hover:-translate-y-1 active:translate-y-0 ${colors[color]}`}
    >
      {label}
    </button>
  );
}
