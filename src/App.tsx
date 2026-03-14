/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Moon, Sun, User, Medal, Lightbulb, Users, UploadCloud, 
  FileText, CheckCircle, MessageSquare, Copy, Eye, Download, Info, Save, Trash2, X,
  TableProperties, Loader2
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

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

  // Gọi AI sử dụng Gemini SDK
  const generateAI = async (studentName: string, level: string, note: string = '', userApiKey: string = '') => {
    // Ưu tiên key từ người dùng nhập, nếu không có thì lấy từ env
    const apiKey = userApiKey || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error("Thiếu API Key. Vui lòng nhập API Key ở ô 'API Configuration' phía trên hoặc thiết lập trong Secrets panel.");
    }

    const ai = new GoogleGenAI({ apiKey });
    const noteInstruction = note ? `\nGHI CHÚ ĐẶC BIỆT TỪ GIÁO VIÊN: "${note}". Hãy lồng ghép ý này vào nhận xét.` : '';

    const promptText = `
      Bạn là chuyên gia giáo dục tiểu học tại Việt Nam. Hãy viết nhận xét đánh giá cuối kỳ bám sát THÔNG TƯ 27/2020/TT-BGDĐT.
      Học sinh: ${studentName}. Khối: ${grade}. Môn: ${subject}.
      Yêu cầu cần đạt (YCCĐ): ${yccd || 'Hoàn thành chương trình môn học'}.
      Mức độ đạt được: ${level}.
      ${noteInstruction}

      YÊU CẦU NỘI DUNG THEO THÔNG TƯ 27:
      1. Thành tích: Nhận xét sự hình thành và phát triển năng lực, phẩm chất. Nêu rõ những ưu điểm nổi bật, sự tiến bộ so với YCCĐ của môn học.
      2. Hạn chế: Chỉ ra những nội dung chưa hoàn thành hoặc kỹ năng còn yếu một cách khéo léo, sư phạm. Đưa ra biện pháp giúp đỡ cụ thể.
      3. Lời khuyên: Hướng dẫn phụ huynh cách phối hợp rèn luyện thêm tại nhà.

      TRẢ VỀ JSON (không có markdown block) với 3 trường: "achievement", "limitation", "parentSupport". 
      Ngôn ngữ: Tiếng Việt, trang trọng, khích lệ.
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        config: { responseMimeType: "application/json" }
      });
      
      const text = response.text;
      if (!text) throw new Error("No response from AI");
      
      const parsed = JSON.parse(text);
      return { 
        id: Date.now() + Math.random(), 
        studentName, 
        level, 
        achievement: parsed.achievement, 
        limitation: parsed.limitation, 
        parentSupport: parsed.parentSupport 
      };
    } catch (e) {
      console.error(e);
      return { 
        id: Date.now() + Math.random(), 
        studentName, 
        level, 
        achievement: "Lỗi kết nối AI. Vui lòng kiểm tra lại API Key.", 
        limitation: "Không thể tạo nội dung.", 
        parentSupport: "Thử lại sau ít phút." 
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

  const exportExcel = () => {
    if (results.length === 0) return;
    let csvContent = '\uFEFFHọ và tên;Mức độ;Thành tích;Hạn chế;Nhắn phụ huynh\n';
    results.forEach(r => {
      const esc = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;
      csvContent += `${esc(r.studentName)};${esc(r.level)};${esc(r.achievement)};${esc(r.limitation)};${esc(r.parentSupport)}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Ket_Qua_Nhan_Xet.csv";
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
                      placeholder="Nhập API Key của bạn (Tùy chọn)..."
                      disabled={isKeySaved}
                      className={`flex-1 px-4 py-2 rounded-xl border-2 outline-none transition-all text-sm ${
                        darkMode ? 'bg-slate-800 border-slate-700 focus:border-blue-500' : 'bg-white border-slate-200 focus:border-blue-500'
                      }`}
                    />
                    {!isKeySaved ? (
                      <button 
                        onClick={() => { if(apiKeyInput) setIsKeySaved(true); }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20"
                      >
                        Lưu Key
                      </button>
                    ) : (
                      <button 
                        onClick={() => { setIsKeySaved(false); setApiKeyInput(""); }}
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
                  <div className={`mt-4 p-4 rounded-xl text-xs leading-relaxed ${darkMode ? 'bg-slate-900 text-slate-400' : 'bg-blue-50 text-blue-800'}`}>
                    <p className="font-bold mb-2">💡 Lưu ý quan trọng:</p>
                    <ul className="list-disc ml-4 space-y-1">
                      <li>Hệ thống đã tích hợp sẵn luồng chạy ngầm, bạn có thể sử dụng ngay mà không cần nhập Key.</li>
                      <li>Nếu bạn muốn sử dụng Key riêng (Groq/Gemini), hãy dán vào ô trên và nhấn "Lưu Key".</li>
                      <li>Key của bạn được bảo mật và chỉ lưu trữ cục bộ trên trình duyệt này.</li>
                    </ul>
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
                        <button 
                          onClick={() => copyToClipboard(
                            activeTab === 'achievement' ? res.achievement : 
                            activeTab === 'limitation' ? res.limitation : res.parentSupport
                          )}
                          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-blue-500 transition-all"
                        >
                          <Copy size={18}/>
                        </button>
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
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all"
                >
                  Xuất Excel (.csv)
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
