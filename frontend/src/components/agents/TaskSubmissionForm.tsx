import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { DAGPreview } from './DAGPreview';
import { useTaskSubmit } from '../../hooks/useTaskSubmit';
import { useToast } from '../../context/ToastContext';
import { FormField } from '../common/FormField';
import { taskSchema, type TaskFormValues } from '../../schemas/task';
import type { AgentPreference, TaskSubmitResponse } from '../../services/taskService';

const agentPreferences = [
  { label: 'Research Agent', value: 'research' as const },
  { label: 'Risk Agent', value: 'risk' as const },
  { label: 'Coding Agent', value: 'coding' as const },
  { label: 'Design Agent', value: 'design' as const },
  { label: 'Report Agent', value: 'report' as const },
];

export function TaskSubmissionForm() {
  const navigate = useNavigate();
  const [preview, setPreview] = useState<TaskSubmitResponse['dagPreview'] | null>(null);
  const { submitTask, status, error, data } = useTaskSubmit();
  const { showToast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, touchedFields, isSubmitting, isValid },
  } = useForm<TaskFormValues>({
    mode: 'onBlur',
    resolver: zodResolver(taskSchema),
    defaultValues: {
      prompt: '',
      maxBudgetXLM: 0.1,
      agentPreferences: [],
    },
  });

  const promptValue = watch('prompt');

  const onSubmit = async (values: TaskFormValues) => {
    try {
      const result = await submitTask(values);
      setPreview(result.dagPreview);
      showToast('Task submitted successfully!', 'success');

      window.setTimeout(() => {
        navigate(`/tasks/${result.taskId}`);
      }, 300);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Unable to submit task';
      showToast(message, 'error');
    }
  };

  const previewData = preview ?? data?.dagPreview;
  const isLoading = status === 'loading' || isSubmitting;

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px' }}>
      <h1>Submit a New Task</h1>

      <form onSubmit={handleSubmit(onSubmit)} noValidate id="task-form">
        <FormField
          label="Task prompt"
          as="textarea"
          id="prompt"
          rows={6}
          maxLength={1000}
          error={errors.prompt?.message}
          isTouched={touchedFields.prompt}
          helperText={`${promptValue.length}/1000 characters`}
          {...register('prompt')}
        />

        <FormField
          label="Maximum budget (XLM)"
          type="number"
          step="0.1"
          min="0.1"
          id="maxBudgetXLM"
          style={{ width: 180 }}
          error={errors.maxBudgetXLM?.message}
          isTouched={touchedFields.maxBudgetXLM}
          {...register('maxBudgetXLM', { valueAsNumber: true })}
        />

        <div style={{ marginBottom: 20 }}>
          <span id="agentPreferences-label" style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
            Agent preferences
          </span>
          <Controller
            control={control}
            name="agentPreferences"
            render={({ field }) => (
              <div
                role="group"
                aria-labelledby="agentPreferences-label"
                aria-describedby="agentPreferences-error"
                aria-invalid={Boolean(errors.agentPreferences)}
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}
              >
                {agentPreferences.map((option) => (
                  <label
                    key={option.value}
                    htmlFor={`pref-${option.value}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: 12,
                      borderRadius: 10,
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      id={`pref-${option.value}`}
                      type="checkbox"
                      value={option.value}
                      checked={field.value.includes(option.value)}
                      onChange={(event) => {
                        const current = field.value;
                        const next = event.target.checked
                          ? [...current, option.value]
                          : current.filter((value: AgentPreference) => value !== option.value);
                        field.onChange(next);
                      }}
                      onBlur={field.onBlur}
                      name={field.name}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            )}
          />
          <div aria-live="polite" id="agentPreferences-error">
            {errors.agentPreferences && (
              <p style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#b91c1c', marginTop: 8, fontSize: '0.875rem' }}>
                <AlertCircle size={16} />
                {errors.agentPreferences.message}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 32 }}>
          <button
            type="submit"
            id="btn-submit-task"
            disabled={isLoading || !isValid}
            style={{
              padding: '12px 20px',
              borderRadius: 10,
              border: 'none',
              background: (!isValid || isLoading) ? '#9ca3af' : '#2563eb',
              color: '#ffffff',
              cursor: (!isValid || isLoading) ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {isLoading ? 'Submitting...' : status === 'success' ? 'Submitted' : 'Submit task'}
          </button>
          {status === 'success' && (
            <span style={{ color: '#16a34a' }}>Task submitted successfully. Redirecting...</span>
          )}
        </div>
      </form>

      <section style={{ marginBottom: 24 }}>
        <h2>Execution DAG preview</h2>
        {isLoading && (
          <div aria-busy="true" style={{ padding: 24, background: 'var(--bg-secondary)', borderRadius: 12 }}>
            <div style={{ height: 18, width: '45%', background: 'var(--bg-surface-alt)', borderRadius: 8, marginBottom: 12 }} />
            <div style={{ height: 18, width: '70%', background: 'var(--bg-surface-alt)', borderRadius: 8, marginBottom: 12 }} />
            <div style={{ height: 18, width: '55%', background: 'var(--bg-surface-alt)', borderRadius: 8 }} />
          </div>
        )}
        {!isLoading && <DAGPreview dagPreview={previewData ?? undefined} />}
      </section>

      {error && (
        <div
          role="status"
          style={{
            marginTop: 24,
            padding: 16,
            borderRadius: 12,
            background: '#f8d7da',
            color: '#842029',
          }}
        >
          {error}
        </div>
      )}
    </main>
  );
}
