import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { fetchObjectivesWithDetails, calculateObjectiveDuration } from '../lib/objectiveService';
import type { Objective } from '../types/objective';
import { todayInLimaISO } from '../lib/todayLima';

// Suggested categories
const CATEGORIES = ['Vocabulary', 'Grammar', 'Reading', 'Writing', 'Listening', 'Speaking', 'Practice', 'Review'];

export function GoalsPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [objectives, setObjectives] = useState<Objective[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isOperating, setIsOperating] = useState(false);

    // Forms state
    const [showObjectiveForm, setShowObjectiveForm] = useState(false);
    const [newObjectiveTitle, setNewObjectiveTitle] = useState('');
    const [expandedObjective, setExpandedObjective] = useState<string | null>(null);
    const [expandedTask, setExpandedTask] = useState<string | null>(null);

    // Edit objective state
    const [editingObjectiveId, setEditingObjectiveId] = useState<string | null>(null);
    const [editingObjectiveTitle, setEditingObjectiveTitle] = useState('');

    // Task form
    const [showTaskForm, setShowTaskForm] = useState<string | null>(null);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskCategory, setNewTaskCategory] = useState('');

    // Subtask form
    const [showSubtaskForm, setShowSubtaskForm] = useState<string | null>(null);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
    const [newSubtaskPhase, setNewSubtaskPhase] = useState(1);
    const [newSubtaskDays, setNewSubtaskDays] = useState(7);

    // Edit task state
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editingTaskTitle, setEditingTaskTitle] = useState('');

    // Edit subtask state
    const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
    const [editingSubtaskTitle, setEditingSubtaskTitle] = useState('');

    const fetchData = useCallback(async () => {
        if (!isSupabaseConfigured || !user) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const data = await fetchObjectivesWithDetails(user.id);
            setObjectives(data);
        } catch (err) {
            console.error('Error fetching objectives:', err);
            setError('Error loading objectives.');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAddObjective = async () => {
        if (!user || !newObjectiveTitle.trim()) return;
        setIsOperating(true);

        try {
            const { data, error: insertError } = await supabase
                .from('objectives')
                .insert({
                    title: newObjectiveTitle.trim(),
                    start_date: todayInLimaISO(),
                    user_id: user.id
                })
                .select()
                .single();

            if (insertError) throw insertError;

            if (data) {
                setObjectives(prev => [{
                    ...data,
                    tasks: [],
                    calculated_duration: 0,
                    days_elapsed: 0
                }, ...prev]);
                setNewObjectiveTitle('');
                setShowObjectiveForm(false);
                setExpandedObjective(data.id);
            }
        } catch (err) {
            console.error('Error adding objective:', err);
            setError('Error adding objective.');
        } finally {
            setIsOperating(false);
        }
    };

    const handleAddTask = async (objectiveId: string) => {
        if (!newTaskTitle.trim() || !newTaskCategory.trim()) return;
        setIsOperating(true);

        try {
            const { data, error: insertError } = await supabase
                .from('objective_tasks')
                .insert({
                    objective_id: objectiveId,
                    title: newTaskTitle.trim(),
                    category: newTaskCategory.trim()
                })
                .select()
                .single();

            if (insertError) throw insertError;

            if (data) {
                setObjectives(prev => prev.map(obj => {
                    if (obj.id === objectiveId) {
                        return {
                            ...obj,
                            tasks: [...(obj.tasks || []), { ...data, subtasks: [] }]
                        };
                    }
                    return obj;
                }));
                setNewTaskTitle('');
                setNewTaskCategory('');
                setShowTaskForm(null);
                setExpandedTask(data.id);
            }
        } catch (err) {
            console.error('Error adding task:', err);
            setError('Error adding task.');
        } finally {
            setIsOperating(false);
        }
    };

    const handleAddSubtask = async (taskId: string) => {
        if (!newSubtaskTitle.trim() || newSubtaskDays < 1) return;
        setIsOperating(true);

        try {
            const { data, error: insertError } = await supabase
                .from('objective_subtasks')
                .insert({
                    task_id: taskId,
                    title: newSubtaskTitle.trim(),
                    phase_order: newSubtaskPhase,
                    duration_days: newSubtaskDays
                })
                .select()
                .single();

            if (insertError) throw insertError;

            if (data) {
                await fetchData(); // Refresh to recalculate durations
                setNewSubtaskTitle('');
                setNewSubtaskPhase(1);
                setNewSubtaskDays(7);
                setShowSubtaskForm(null);
            }
        } catch (err) {
            console.error('Error adding subtask:', err);
            setError('Error adding subtask.');
        } finally {
            setIsOperating(false);
        }
    };

    const handleDeleteObjective = async (id: string) => {
        if (!confirm('Delete this objective and all its tasks?')) return;
        setIsOperating(true);

        try {
            await supabase.from('objectives').delete().eq('id', id);
            setObjectives(prev => prev.filter(o => o.id !== id));
        } catch (err) {
            console.error('Error deleting objective:', err);
        } finally {
            setIsOperating(false);
        }
    };

    const handleEditObjective = (objective: Objective) => {
        setEditingObjectiveId(objective.id);
        setEditingObjectiveTitle(objective.title);
    };

    const handleSaveObjectiveEdit = async () => {
        if (!editingObjectiveId || !editingObjectiveTitle.trim()) {
            setEditingObjectiveId(null);
            return;
        }
        setIsOperating(true);

        try {
            const { error: updateError } = await supabase
                .from('objectives')
                .update({ title: editingObjectiveTitle.trim() })
                .eq('id', editingObjectiveId);

            if (updateError) throw updateError;

            setObjectives(prev => prev.map(obj =>
                obj.id === editingObjectiveId
                    ? { ...obj, title: editingObjectiveTitle.trim() }
                    : obj
            ));
            setEditingObjectiveId(null);
        } catch (err) {
            console.error('Error updating objective:', err);
            setError('Error updating objective.');
        } finally {
            setIsOperating(false);
        }
    };

    const handleCancelObjectiveEdit = () => {
        setEditingObjectiveId(null);
        setEditingObjectiveTitle('');
    };

    // Task edit/delete handlers
    const handleDeleteTask = async (taskId: string, objectiveId: string) => {
        if (!confirm('Delete this task and all its subtasks?')) return;
        setIsOperating(true);

        try {
            await supabase.from('objective_tasks').delete().eq('id', taskId);
            setObjectives(prev => prev.map(obj => {
                if (obj.id === objectiveId) {
                    return {
                        ...obj,
                        tasks: (obj.tasks || []).filter(t => t.id !== taskId)
                    };
                }
                return obj;
            }));
        } catch (err) {
            console.error('Error deleting task:', err);
        } finally {
            setIsOperating(false);
        }
    };

    const handleEditTask = (task: { id: string; title: string }) => {
        setEditingTaskId(task.id);
        setEditingTaskTitle(task.title);
    };

    const handleSaveTaskEdit = async (objectiveId: string) => {
        if (!editingTaskId || !editingTaskTitle.trim()) {
            setEditingTaskId(null);
            return;
        }
        setIsOperating(true);

        try {
            const { error: updateError } = await supabase
                .from('objective_tasks')
                .update({ title: editingTaskTitle.trim() })
                .eq('id', editingTaskId);

            if (updateError) throw updateError;

            setObjectives(prev => prev.map(obj => {
                if (obj.id === objectiveId) {
                    return {
                        ...obj,
                        tasks: (obj.tasks || []).map(t =>
                            t.id === editingTaskId
                                ? { ...t, title: editingTaskTitle.trim() }
                                : t
                        )
                    };
                }
                return obj;
            }));
            setEditingTaskId(null);
        } catch (err) {
            console.error('Error updating task:', err);
            setError('Error updating task.');
        } finally {
            setIsOperating(false);
        }
    };

    const handleCancelTaskEdit = () => {
        setEditingTaskId(null);
        setEditingTaskTitle('');
    };

    // Subtask edit/delete handlers
    const handleDeleteSubtask = async (subtaskId: string) => {
        if (!confirm('Delete this subtask?')) return;
        setIsOperating(true);

        try {
            await supabase.from('objective_subtasks').delete().eq('id', subtaskId);
            await fetchData(); // Refresh to recalculate durations
        } catch (err) {
            console.error('Error deleting subtask:', err);
        } finally {
            setIsOperating(false);
        }
    };

    const handleEditSubtask = (subtask: { id: string; title: string }) => {
        setEditingSubtaskId(subtask.id);
        setEditingSubtaskTitle(subtask.title);
    };

    const handleSaveSubtaskEdit = async () => {
        if (!editingSubtaskId || !editingSubtaskTitle.trim()) {
            setEditingSubtaskId(null);
            return;
        }
        setIsOperating(true);

        try {
            const { error: updateError } = await supabase
                .from('objective_subtasks')
                .update({ title: editingSubtaskTitle.trim() })
                .eq('id', editingSubtaskId);

            if (updateError) throw updateError;

            await fetchData(); // Refresh to update UI
            setEditingSubtaskId(null);
        } catch (err) {
            console.error('Error updating subtask:', err);
            setError('Error updating subtask.');
        } finally {
            setIsOperating(false);
        }
    };

    const handleCancelSubtaskEdit = () => {
        setEditingSubtaskId(null);
        setEditingSubtaskTitle('');
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <nav className="bg-white border-b border-slate-200">
                <div className="max-w-4xl mx-auto px-4 sm:px-6">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate('/todos')}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <h1 className="text-xl font-bold text-slate-800">Goal Planning</h1>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => navigate('/vocabulary')}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 
                                    bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                <span>📚</span>
                                <span>Vocabulary</span>
                            </button>
                            <button
                                onClick={() => navigate('/todos')}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 
                                    bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                <span>📋</span>
                                <span>Daily Tasks</span>
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
                {/* Add Objective Button */}
                <div className="mb-8">
                    {!showObjectiveForm ? (
                        <button
                            onClick={() => setShowObjectiveForm(true)}
                            className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl
                                text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50
                                transition-all duration-200 font-medium"
                        >
                            + Create New Objective
                        </button>
                    ) : (
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="text-lg font-semibold text-slate-800 mb-4">New Objective</h3>
                            <input
                                type="text"
                                value={newObjectiveTitle}
                                onChange={(e) => setNewObjectiveTitle(e.target.value)}
                                placeholder="What do you want to achieve?"
                                autoFocus
                                maxLength={200}
                                className="w-full px-4 py-3 border border-slate-200 rounded-lg mb-4
                                    focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={handleAddObjective}
                                    disabled={!newObjectiveTitle.trim() || isOperating}
                                    className="flex-1 py-2.5 bg-indigo-500 text-white font-medium rounded-lg
                                        hover:bg-indigo-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                                >
                                    Create Objective
                                </button>
                                <button
                                    onClick={() => { setShowObjectiveForm(false); setNewObjectiveTitle(''); }}
                                    className="px-4 py-2.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                {/* Loading */}
                {loading ? (
                    <div className="flex flex-col items-center py-16">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent mb-4"></div>
                        <p className="text-slate-500">Loading...</p>
                    </div>
                ) : objectives.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-20 h-20 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                            <span className="text-4xl">🎯</span>
                        </div>
                        <p className="text-slate-600 mb-2">No objectives yet</p>
                        <p className="text-sm text-slate-400">Create your first objective to start planning</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {objectives.map((objective) => {
                            const duration = calculateObjectiveDuration(objective);
                            const isExpanded = expandedObjective === objective.id;

                            return (
                                <div key={objective.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                    {/* Objective Header */}
                                    <div
                                        className="p-5 cursor-pointer hover:bg-slate-50 transition-colors"
                                        onClick={() => setExpandedObjective(isExpanded ? null : objective.id)}
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className={`p-2 rounded-lg transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                                                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>

                                            <div className="flex-1">
                                                {editingObjectiveId === objective.id ? (
                                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="text"
                                                            value={editingObjectiveTitle}
                                                            onChange={(e) => setEditingObjectiveTitle(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleSaveObjectiveEdit();
                                                                if (e.key === 'Escape') handleCancelObjectiveEdit();
                                                            }}
                                                            autoFocus
                                                            className="flex-1 px-3 py-1.5 text-lg font-semibold border border-indigo-300 rounded-lg
                                                                focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                        />
                                                        <button
                                                            onClick={handleSaveObjectiveEdit}
                                                            disabled={isOperating}
                                                            className="p-2 text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={handleCancelObjectiveEdit}
                                                            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <h3 className="text-lg font-semibold text-slate-800">{objective.title}</h3>
                                                )}
                                                <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                                                    <span>{duration} days total</span>
                                                    <span>•</span>
                                                    <span>{(objective.tasks || []).length} tasks</span>
                                                    <span>•</span>
                                                    <span>Started {new Date(objective.start_date).toLocaleDateString()}</span>
                                                </div>

                                                {/* Progress bar */}
                                                {duration > 0 && (
                                                    <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-indigo-500 transition-all"
                                                            style={{ width: `${Math.min(100, ((objective.days_elapsed || 0) / duration) * 100)}%` }}
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Edit button */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleEditObjective(objective); }}
                                                className="p-2 text-slate-300 hover:text-indigo-500 rounded-lg transition-colors"
                                                title="Edit objective"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
                                            </button>

                                            {/* Delete button */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteObjective(objective.id); }}
                                                className="p-2 text-slate-300 hover:text-red-500 rounded-lg transition-colors"
                                                title="Delete objective"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded Content */}
                                    {isExpanded && (
                                        <div className="border-t border-slate-100 p-5 bg-slate-50">
                                            {/* Tasks */}
                                            <div className="space-y-3">
                                                {(objective.tasks || []).map((task) => {
                                                    const isTaskExpanded = expandedTask === task.id;
                                                    const phases = [...new Set((task.subtasks || []).map(s => s.phase_order))].sort((a, b) => a - b);

                                                    return (
                                                        <div key={task.id} className="bg-white rounded-lg border border-slate-200">
                                                            {/* Task Header */}
                                                            <div
                                                                className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                                                                onClick={() => setExpandedTask(isTaskExpanded ? null : task.id)}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-1.5 h-8 bg-indigo-400 rounded-full"></div>
                                                                    <div className="flex-1">
                                                                        {editingTaskId === task.id ? (
                                                                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                                                <input
                                                                                    type="text"
                                                                                    value={editingTaskTitle}
                                                                                    onChange={(e) => setEditingTaskTitle(e.target.value)}
                                                                                    onKeyDown={(e) => {
                                                                                        if (e.key === 'Enter') handleSaveTaskEdit(objective.id);
                                                                                        if (e.key === 'Escape') handleCancelTaskEdit();
                                                                                    }}
                                                                                    autoFocus
                                                                                    className="flex-1 px-2 py-1 text-sm font-medium border border-indigo-300 rounded-lg
                                                                                        focus:ring-2 focus:ring-indigo-500"
                                                                                />
                                                                                <button
                                                                                    onClick={() => handleSaveTaskEdit(objective.id)}
                                                                                    disabled={isOperating}
                                                                                    className="p-1.5 text-white bg-indigo-500 hover:bg-indigo-600 rounded transition-colors"
                                                                                >
                                                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                                    </svg>
                                                                                </button>
                                                                                <button
                                                                                    onClick={handleCancelTaskEdit}
                                                                                    className="p-1.5 text-slate-500 hover:bg-slate-100 rounded transition-colors"
                                                                                >
                                                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                                    </svg>
                                                                                </button>
                                                                            </div>
                                                                        ) : (
                                                                            <>
                                                                                <p className="font-medium text-slate-700">{task.title}</p>
                                                                                <p className="text-xs text-slate-400 mt-0.5">
                                                                                    {task.category} • {(task.subtasks || []).length} subtasks
                                                                                </p>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                    {/* Task action buttons */}
                                                                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                                        <button
                                                                            onClick={() => handleEditTask(task)}
                                                                            className="p-1.5 text-slate-300 hover:text-indigo-500 rounded transition-colors"
                                                                            title="Edit task"
                                                                        >
                                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                                            </svg>
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteTask(task.id, objective.id)}
                                                                            className="p-1.5 text-slate-300 hover:text-red-500 rounded transition-colors"
                                                                            title="Delete task"
                                                                        >
                                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                            </svg>
                                                                        </button>
                                                                    </div>
                                                                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${isTaskExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                                    </svg>
                                                                </div>
                                                            </div>

                                                            {/* Subtasks */}
                                                            {isTaskExpanded && (
                                                                <div className="border-t border-slate-100 p-4 bg-slate-50">
                                                                    {phases.map((phase) => {
                                                                        const phaseSubtasks = (task.subtasks || []).filter(s => s.phase_order === phase);
                                                                        return (
                                                                            <div key={phase} className="mb-4 last:mb-0">
                                                                                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                                                                                    Phase {phase}
                                                                                </p>
                                                                                <div className="space-y-2">
                                                                                    {phaseSubtasks.map((subtask) => (
                                                                                        <div key={subtask.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 group">
                                                                                            <span className="w-6 h-6 flex items-center justify-center bg-indigo-100 text-indigo-600 text-xs font-bold rounded">
                                                                                                {subtask.phase_order}
                                                                                            </span>
                                                                                            {editingSubtaskId === subtask.id ? (
                                                                                                <div className="flex-1 flex items-center gap-2">
                                                                                                    <input
                                                                                                        type="text"
                                                                                                        value={editingSubtaskTitle}
                                                                                                        onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                                                                                                        onKeyDown={(e) => {
                                                                                                            if (e.key === 'Enter') handleSaveSubtaskEdit();
                                                                                                            if (e.key === 'Escape') handleCancelSubtaskEdit();
                                                                                                        }}
                                                                                                        autoFocus
                                                                                                        className="flex-1 px-2 py-1 text-sm border border-indigo-300 rounded
                                                                                                            focus:ring-1 focus:ring-indigo-500"
                                                                                                    />
                                                                                                    <button
                                                                                                        onClick={handleSaveSubtaskEdit}
                                                                                                        disabled={isOperating}
                                                                                                        className="p-1 text-white bg-indigo-500 hover:bg-indigo-600 rounded transition-colors"
                                                                                                    >
                                                                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                                                        </svg>
                                                                                                    </button>
                                                                                                    <button
                                                                                                        onClick={handleCancelSubtaskEdit}
                                                                                                        className="p-1 text-slate-500 hover:bg-slate-100 rounded transition-colors"
                                                                                                    >
                                                                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                                                        </svg>
                                                                                                    </button>
                                                                                                </div>
                                                                                            ) : (
                                                                                                <>
                                                                                                    <span className="flex-1 text-sm text-slate-700">{subtask.title}</span>
                                                                                                    <span className="text-xs text-slate-400">{subtask.duration_days}d</span>
                                                                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                                        <button
                                                                                                            onClick={() => handleEditSubtask(subtask)}
                                                                                                            className="p-1 text-slate-300 hover:text-indigo-500 rounded transition-colors"
                                                                                                            title="Edit subtask"
                                                                                                        >
                                                                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                                                                            </svg>
                                                                                                        </button>
                                                                                                        <button
                                                                                                            onClick={() => handleDeleteSubtask(subtask.id)}
                                                                                                            className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors"
                                                                                                            title="Delete subtask"
                                                                                                        >
                                                                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                                                            </svg>
                                                                                                        </button>
                                                                                                    </div>
                                                                                                </>
                                                                                            )}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}

                                                                    {/* Add Subtask Form */}
                                                                    {showSubtaskForm === task.id ? (
                                                                        <div className="mt-4 p-4 bg-white rounded-lg border border-slate-200">
                                                                            <input
                                                                                type="text"
                                                                                value={newSubtaskTitle}
                                                                                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                                                                placeholder="Subtask title..."
                                                                                autoFocus
                                                                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg mb-3
                                                                                    focus:ring-1 focus:ring-indigo-400"
                                                                            />
                                                                            <div className="flex gap-4 mb-3">
                                                                                <div className="flex-1">
                                                                                    <label className="text-xs text-slate-500 mb-1 block">Phase</label>
                                                                                    <div className="flex gap-1">
                                                                                        {[1, 2, 3, 4, 5].map(p => (
                                                                                            <button
                                                                                                key={p}
                                                                                                type="button"
                                                                                                onClick={() => setNewSubtaskPhase(p)}
                                                                                                className={`w-8 h-8 text-sm rounded-lg transition-colors
                                                                                                    ${newSubtaskPhase === p
                                                                                                        ? 'bg-indigo-500 text-white'
                                                                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                                                                    }`}
                                                                                            >
                                                                                                {p}
                                                                                            </button>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="w-24">
                                                                                    <label className="text-xs text-slate-500 mb-1 block">Days</label>
                                                                                    <input
                                                                                        type="number"
                                                                                        value={newSubtaskDays}
                                                                                        onChange={(e) => setNewSubtaskDays(Math.max(1, parseInt(e.target.value) || 1))}
                                                                                        min={1}
                                                                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex gap-2">
                                                                                <button
                                                                                    onClick={() => handleAddSubtask(task.id)}
                                                                                    disabled={!newSubtaskTitle.trim() || isOperating}
                                                                                    className="flex-1 py-2 text-sm bg-indigo-500 text-white rounded-lg
                                                                                        hover:bg-indigo-600 disabled:bg-slate-300 transition-colors"
                                                                                >
                                                                                    Add
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => setShowSubtaskForm(null)}
                                                                                    className="px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-lg"
                                                                                >
                                                                                    Cancel
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => setShowSubtaskForm(task.id)}
                                                                            className="mt-3 w-full py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                                        >
                                                                            + Add Subtask
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Add Task Form */}
                                            {showTaskForm === objective.id ? (
                                                <div className="mt-4 p-4 bg-white rounded-lg border border-slate-200">
                                                    <input
                                                        type="text"
                                                        value={newTaskTitle}
                                                        onChange={(e) => setNewTaskTitle(e.target.value)}
                                                        placeholder="Task title..."
                                                        autoFocus
                                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg mb-3
                                                            focus:ring-1 focus:ring-indigo-400"
                                                    />
                                                    <div className="mb-3">
                                                        <p className="text-xs text-slate-500 mb-2">Category</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {CATEGORIES.map(cat => (
                                                                <button
                                                                    key={cat}
                                                                    type="button"
                                                                    onClick={() => setNewTaskCategory(cat)}
                                                                    className={`px-3 py-1.5 text-xs rounded-full transition-colors
                                                                        ${newTaskCategory === cat
                                                                            ? 'bg-indigo-500 text-white'
                                                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                                        }`}
                                                                >
                                                                    {cat}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleAddTask(objective.id)}
                                                            disabled={!newTaskTitle.trim() || !newTaskCategory.trim() || isOperating}
                                                            className="flex-1 py-2 text-sm bg-indigo-500 text-white rounded-lg
                                                                hover:bg-indigo-600 disabled:bg-slate-300 transition-colors"
                                                        >
                                                            Add Task
                                                        </button>
                                                        <button
                                                            onClick={() => { setShowTaskForm(null); setNewTaskTitle(''); setNewTaskCategory(''); }}
                                                            className="px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-lg"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setShowTaskForm(objective.id)}
                                                    className="mt-4 w-full py-3 border border-dashed border-slate-300 rounded-lg
                                                        text-sm text-slate-500 hover:text-indigo-600 hover:border-indigo-300 
                                                        hover:bg-white transition-all"
                                                >
                                                    + Add Task
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
