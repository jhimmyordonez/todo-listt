import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import type { VocabularyWord } from '../types/vocabulary';

export function VocabularyPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [words, setWords] = useState<VocabularyWord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isOperating, setIsOperating] = useState(false);

    // Add word form
    const [showAddForm, setShowAddForm] = useState(false);
    const [newEnglish, setNewEnglish] = useState('');
    const [newSpanish, setNewSpanish] = useState('');

    // Edit word
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editEnglish, setEditEnglish] = useState('');
    const [editSpanish, setEditSpanish] = useState('');

    // Practice mode
    const [practiceMode, setPracticeMode] = useState(false);
    const [practiceWords, setPracticeWords] = useState<VocabularyWord[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState('');
    const [showResult, setShowResult] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [practiceScore, setPracticeScore] = useState({ correct: 0, total: 0 });
    const [practiceComplete, setPracticeComplete] = useState(false);

    const fetchWords = useCallback(async () => {
        if (!isSupabaseConfigured || !user) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { data, error: fetchError } = await supabase
                .from('vocabulary')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;
            setWords(data || []);
        } catch (err) {
            console.error('Error fetching vocabulary:', err);
            setError('Error loading vocabulary.');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchWords();
    }, [fetchWords]);

    const handleAddWord = async () => {
        if (!user || !newEnglish.trim() || !newSpanish.trim()) return;
        setIsOperating(true);

        try {
            const { data, error: insertError } = await supabase
                .from('vocabulary')
                .insert({
                    user_id: user.id,
                    english: newEnglish.trim().toLowerCase(),
                    spanish: newSpanish.trim().toLowerCase()
                })
                .select()
                .single();

            if (insertError) throw insertError;

            if (data) {
                setWords(prev => [data, ...prev]);
                setNewEnglish('');
                setNewSpanish('');
                setShowAddForm(false);
            }
        } catch (err) {
            console.error('Error adding word:', err);
            setError('Error adding word.');
        } finally {
            setIsOperating(false);
        }
    };

    const handleDeleteWord = async (id: string) => {
        if (!confirm('Delete this word?')) return;
        setIsOperating(true);

        try {
            await supabase.from('vocabulary').delete().eq('id', id);
            setWords(prev => prev.filter(w => w.id !== id));
        } catch (err) {
            console.error('Error deleting word:', err);
        } finally {
            setIsOperating(false);
        }
    };

    const handleEditWord = (word: VocabularyWord) => {
        setEditingId(word.id);
        setEditEnglish(word.english);
        setEditSpanish(word.spanish);
    };

    const handleSaveEdit = async () => {
        if (!editingId || !editEnglish.trim() || !editSpanish.trim()) {
            setEditingId(null);
            return;
        }
        setIsOperating(true);

        try {
            const { error: updateError } = await supabase
                .from('vocabulary')
                .update({
                    english: editEnglish.trim().toLowerCase(),
                    spanish: editSpanish.trim().toLowerCase()
                })
                .eq('id', editingId);

            if (updateError) throw updateError;

            setWords(prev => prev.map(w =>
                w.id === editingId
                    ? { ...w, english: editEnglish.trim().toLowerCase(), spanish: editSpanish.trim().toLowerCase() }
                    : w
            ));
            setEditingId(null);
        } catch (err) {
            console.error('Error updating word:', err);
            setError('Error updating word.');
        } finally {
            setIsOperating(false);
        }
    };

    const startPractice = () => {
        if (words.length === 0) {
            setError('Add some words first before practicing!');
            return;
        }

        // Shuffle and pick up to 20 words
        const shuffled = [...words].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, Math.min(20, shuffled.length));

        setPracticeWords(selected);
        setCurrentIndex(0);
        setPracticeScore({ correct: 0, total: 0 });
        setUserAnswer('');
        setShowResult(false);
        setPracticeComplete(false);
        setPracticeMode(true);
    };

    const checkAnswer = async () => {
        const currentWord = practiceWords[currentIndex];
        const correct = userAnswer.trim().toLowerCase() === currentWord.spanish.toLowerCase();

        setIsCorrect(correct);
        setShowResult(true);
        setPracticeScore(prev => ({
            correct: prev.correct + (correct ? 1 : 0),
            total: prev.total + 1
        }));

        // Update stats in database
        try {
            await supabase
                .from('vocabulary')
                .update({
                    times_practiced: currentWord.times_practiced + 1,
                    times_correct: currentWord.times_correct + (correct ? 1 : 0)
                })
                .eq('id', currentWord.id);
        } catch (err) {
            console.error('Error updating stats:', err);
        }
    };

    const nextWord = () => {
        if (currentIndex + 1 >= practiceWords.length) {
            setPracticeComplete(true);
        } else {
            setCurrentIndex(prev => prev + 1);
            setUserAnswer('');
            setShowResult(false);
        }
    };

    const endPractice = () => {
        setPracticeMode(false);
        fetchWords(); // Refresh to get updated stats
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <nav className="bg-white border-b border-slate-200">
                <div className="max-w-4xl mx-auto px-4 sm:px-6">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate('/goals')}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <h1 className="text-xl font-bold text-slate-800">📚 Vocabulary</h1>
                        </div>

                        <div className="flex items-center gap-2">
                            {!practiceMode && (
                                <>
                                    <button
                                        onClick={startPractice}
                                        disabled={words.length === 0}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white
                                            bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors
                                            disabled:bg-slate-300 disabled:cursor-not-allowed"
                                    >
                                        <span>🎯</span>
                                        <span>Practice</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
                {/* Error */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600">{error}</p>
                        <button
                            onClick={() => setError(null)}
                            className="mt-2 text-xs text-red-500 underline"
                        >
                            Dismiss
                        </button>
                    </div>
                )}

                {/* Practice Mode */}
                {practiceMode ? (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
                        {practiceComplete ? (
                            // Practice Complete
                            <div className="text-center py-8">
                                <div className="w-20 h-20 mx-auto mb-6 bg-indigo-100 rounded-full flex items-center justify-center">
                                    <span className="text-4xl">🎉</span>
                                </div>
                                <h2 className="text-2xl font-bold text-slate-800 mb-2">Practice Complete!</h2>
                                <p className="text-lg text-slate-600 mb-6">
                                    You got <span className="font-bold text-indigo-600">{practiceScore.correct}</span> out of{' '}
                                    <span className="font-bold">{practiceScore.total}</span> correct
                                </p>
                                <div className="text-6xl mb-6">
                                    {practiceScore.correct === practiceScore.total ? '🏆' :
                                        practiceScore.correct >= practiceScore.total * 0.8 ? '⭐' :
                                            practiceScore.correct >= practiceScore.total * 0.5 ? '👍' : '💪'}
                                </div>
                                <button
                                    onClick={endPractice}
                                    className="px-6 py-3 bg-indigo-500 text-white font-medium rounded-lg 
                                        hover:bg-indigo-600 transition-colors"
                                >
                                    Back to Vocabulary
                                </button>
                            </div>
                        ) : (
                            // Practice Question
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <span className="text-sm text-slate-500">
                                        Word {currentIndex + 1} of {practiceWords.length}
                                    </span>
                                    <button
                                        onClick={endPractice}
                                        className="text-sm text-slate-400 hover:text-slate-600"
                                    >
                                        Exit Practice
                                    </button>
                                </div>

                                <div className="text-center mb-8">
                                    <p className="text-sm text-slate-500 mb-2">Translate to Spanish:</p>
                                    <p className="text-4xl font-bold text-slate-800">
                                        {practiceWords[currentIndex]?.english}
                                    </p>
                                </div>

                                {!showResult ? (
                                    <div className="space-y-4">
                                        <input
                                            type="text"
                                            value={userAnswer}
                                            onChange={(e) => setUserAnswer(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && userAnswer.trim() && checkAnswer()}
                                            placeholder="Type the Spanish translation..."
                                            autoFocus
                                            className="w-full px-4 py-3 text-lg text-center border border-slate-200 rounded-lg
                                                focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        />
                                        <button
                                            onClick={checkAnswer}
                                            disabled={!userAnswer.trim()}
                                            className="w-full py-3 bg-indigo-500 text-white font-medium rounded-lg
                                                hover:bg-indigo-600 disabled:bg-slate-300 transition-colors"
                                        >
                                            Check Answer
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className={`p-6 rounded-lg text-center ${isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                                            }`}>
                                            <p className="text-2xl mb-2">{isCorrect ? '✅ Correct!' : '❌ Incorrect'}</p>
                                            {!isCorrect && (
                                                <p className="text-slate-600">
                                                    The answer was: <span className="font-bold text-slate-800">
                                                        {practiceWords[currentIndex]?.spanish}
                                                    </span>
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            onClick={nextWord}
                                            className="w-full py-3 bg-indigo-500 text-white font-medium rounded-lg
                                                hover:bg-indigo-600 transition-colors"
                                        >
                                            {currentIndex + 1 >= practiceWords.length ? 'See Results' : 'Next Word'}
                                        </button>
                                    </div>
                                )}

                                {/* Progress bar */}
                                <div className="mt-8">
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-indigo-500 transition-all"
                                            style={{ width: `${((currentIndex + (showResult ? 1 : 0)) / practiceWords.length) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    // Word List Mode
                    <>
                        {/* Add Word Button/Form */}
                        <div className="mb-8">
                            {!showAddForm ? (
                                <button
                                    onClick={() => setShowAddForm(true)}
                                    className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl
                                        text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50
                                        transition-all duration-200 font-medium"
                                >
                                    + Add New Word
                                </button>
                            ) : (
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Add New Word</h3>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="text-sm text-slate-500 mb-1 block">English</label>
                                            <input
                                                type="text"
                                                value={newEnglish}
                                                onChange={(e) => setNewEnglish(e.target.value)}
                                                placeholder="e.g. hello"
                                                autoFocus
                                                className="w-full px-4 py-3 border border-slate-200 rounded-lg
                                                    focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-slate-500 mb-1 block">Spanish</label>
                                            <input
                                                type="text"
                                                value={newSpanish}
                                                onChange={(e) => setNewSpanish(e.target.value)}
                                                placeholder="e.g. hola"
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddWord()}
                                                className="w-full px-4 py-3 border border-slate-200 rounded-lg
                                                    focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleAddWord}
                                            disabled={!newEnglish.trim() || !newSpanish.trim() || isOperating}
                                            className="flex-1 py-2.5 bg-indigo-500 text-white font-medium rounded-lg
                                                hover:bg-indigo-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Add Word
                                        </button>
                                        <button
                                            onClick={() => { setShowAddForm(false); setNewEnglish(''); setNewSpanish(''); }}
                                            className="px-4 py-2.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Stats */}
                        <div className="mb-6 flex items-center gap-4 text-sm text-slate-500">
                            <span>📚 {words.length} words</span>
                        </div>

                        {/* Word List */}
                        {loading ? (
                            <div className="flex flex-col items-center py-16">
                                <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent mb-4"></div>
                                <p className="text-slate-500">Loading...</p>
                            </div>
                        ) : words.length === 0 ? (
                            <div className="text-center py-16">
                                <div className="w-20 h-20 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                                    <span className="text-4xl">📖</span>
                                </div>
                                <p className="text-slate-600 mb-2">No words yet</p>
                                <p className="text-sm text-slate-400">Add your first word to start building your vocabulary</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                English
                                            </th>
                                            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                Spanish
                                            </th>
                                            <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                Stats
                                            </th>
                                            <th className="px-6 py-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {words.map((word) => (
                                            <tr key={word.id} className="hover:bg-slate-50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    {editingId === word.id ? (
                                                        <input
                                                            type="text"
                                                            value={editEnglish}
                                                            onChange={(e) => setEditEnglish(e.target.value)}
                                                            className="w-full px-2 py-1 border border-indigo-300 rounded
                                                                focus:ring-1 focus:ring-indigo-500"
                                                        />
                                                    ) : (
                                                        <span className="font-medium text-slate-800">{word.english}</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {editingId === word.id ? (
                                                        <input
                                                            type="text"
                                                            value={editSpanish}
                                                            onChange={(e) => setEditSpanish(e.target.value)}
                                                            onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                                                            className="w-full px-2 py-1 border border-indigo-300 rounded
                                                                focus:ring-1 focus:ring-indigo-500"
                                                        />
                                                    ) : (
                                                        <span className="text-slate-600">{word.spanish}</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {word.times_practiced > 0 ? (
                                                        <span className="text-xs text-slate-500">
                                                            {word.times_correct}/{word.times_practiced} correct
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">Not practiced</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {editingId === word.id ? (
                                                        <div className="flex items-center gap-2 justify-end">
                                                            <button
                                                                onClick={handleSaveEdit}
                                                                className="p-1.5 text-white bg-indigo-500 hover:bg-indigo-600 rounded transition-colors"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingId(null)}
                                                                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded transition-colors"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => handleEditWord(word)}
                                                                className="p-1.5 text-slate-300 hover:text-indigo-500 rounded transition-colors"
                                                                title="Edit"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                                </svg>
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteWord(word.id)}
                                                                className="p-1.5 text-slate-300 hover:text-red-500 rounded transition-colors"
                                                                title="Delete"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
