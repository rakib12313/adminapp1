
export interface Notice {
  id: string;
  title: string;
  content: string;
  date: string;
  priority: 'low' | 'medium' | 'high';
  isPinned?: boolean;
}

export interface Resource {
  id: string;
  title: string;
  type: 'pdf' | 'image';
  url: string;
  isProtected: boolean; // If true, only logged in users can see
  category: string;
  canDownload: boolean; // Control if students can save/download the file
  targetClass?: string; // New: Restrict to specific class
  targetDivision?: string; // New: Restrict to specific division
}

export type QuestionType = 'multiple-choice' | 'true-false' | 'short-answer';

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options: string[];
  correctAnswer: number; // Index 0-3 for MC/TF
  correctAnswerText?: string; // For short answer
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  questionCount: number;
  questions: Question[]; 
  totalMarks: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  scheduledDate?: string; // ISO String
  isPublished?: boolean;
  maxAttempts?: number; // 0 means unlimited, otherwise specific count
  shuffleQuestions?: boolean; // New: Randomize order
  negativeMarking?: number; // New: Marks deducted per wrong answer (e.g. 0.25)
  targetClass?: string; // New: Restrict to specific class
  targetDivision?: string; // New: Restrict to specific division
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  phoneNumber: string | null;
  photoURL: string | null;
  role?: 'student' | 'admin' | 'instructor'; 
  joinedAt?: string; // ISO String
  status?: 'active' | 'inactive' | 'suspended';
  lastLogin?: string;
  assignedClass?: string; // New
  assignedDivision?: string; // New
}

export interface ClassGroup {
  id: string;
  name: string; // e.g. "Grade 10"
  divisions: string[]; // e.g. ["A", "B", "C"]
}

export interface Result {
  id: string;
  examId: string;
  examTitle: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  score: number;
  totalMarks: number;
  submittedAt: string; // ISO String
  answers: number[]; // Array of selected option indices
  timeTakenSeconds: number;
  isHidden?: boolean;
}

export interface HelpRequest {
  id: string;
  studentId: string;
  studentName: string;
  email: string;
  subject: string;
  message: string;
  status: 'open' | 'resolved';
  createdAt: string;
  isStarred?: boolean; // New: Priority flag
  adminNotes?: string; // New: Internal notes
}
