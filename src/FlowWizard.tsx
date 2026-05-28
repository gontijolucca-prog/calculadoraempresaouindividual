import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowLeft, ArrowRight, ListOrdered, ShieldCheck } from 'lucide-react';
import { cn } from './lib/utils';

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

export interface FlowStep<T> {
  id: string;
  label: string;
  description: string;
  isVisible?: (state: T) => boolean;
  render: (state: T, setState: (u: Partial<T>) => void) => React.ReactNode;
  skipValue?: any;
  skipLabel?: string;
}

export interface FlowWizardProps<T> {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  steps: FlowStep<T>[];
  resultsStep: { label: string; description: string; render: React.ReactNode };
  state: T;
  setState: (u: Partial<T>) => void;
}

export function FlowWizard<T>({
  open,
  onClose,
  title,
  icon: IconComponent,
  steps,
  resultsStep,
  state,
  setState,
}: FlowWizardProps<T>) {
  const [currentStep, setCurrentStep] = useState(0);

  const visibleSteps = steps.filter(s => (s.isVisible ? s.isVisible(state) : true));
  const totalQuestions = visibleSteps.length;
  const activeStep = visibleSteps[currentStep];
  const isResultsStep = !activeStep;

  const goNext = useCallback(() => {
    if (currentStep < totalQuestions) setCurrentStep(currentStep + 1);
  }, [currentStep, totalQuestions]);

  const goBack = useCallback(() => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    if (activeStep && activeStep.skipValue !== undefined) {
      setState({ [activeStep.id]: activeStep.skipValue } as Partial<T>);
    }
    goNext();
  }, [activeStep, setState, goNext]);

  const progress = isResultsStep
    ? 100
    : Math.round(((currentStep) / Math.max(1, totalQuestions)) * 100);

  if (!open) return null;

  const Icon = IconComponent || ListOrdered;

  return (
    <div className="h-full w-full bg-white flex flex-col overflow-hidden">
      {/* Top progress bar */}
      <div className="shrink-0 w-full h-1.5 bg-[#F1F5F9]">
        <motion.div
          className="h-full bg-[#0677FF]"
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: PREMIUM_EASE }}
        />
      </div>

      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-6 sm:px-10 lg:px-16 py-5">
        <div className="bg-[#F1F5F9] text-[#0F172A] p-2.5 rounded-[12px]">
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-[15px] font-[800] tracking-[-0.3px] text-[#0F172A]">{title}</span>
      </div>

      {/* Main content area.
          Outer scrolls; inner uses `min-h-full + justify-center` so o conteúdo é
          centrado verticalmente quando cabe e cresce para baixo quando não cabe
          — evita o bug clássico de `flex justify-center + overflow-auto` em que o
          topo do conteúdo é cortado pelo header acima. */}
      <div
        className={cn(
          "flex-1",
          isResultsStep ? "overflow-hidden" : "overflow-y-auto"
        )}
      >
        <div
          className={cn(
            "min-h-full w-full flex flex-col items-center px-6 sm:px-12 lg:px-20",
            isResultsStep ? "pt-6 pb-8 h-full" : "py-10 sm:py-14 justify-center"
          )}
        >
        <div className={cn("w-full max-w-6xl", isResultsStep && "h-full")}>
          <AnimatePresence mode="wait">
            <motion.div
              key={isResultsStep ? 'results' : activeStep?.id || 'empty'}
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 0.97 }}
              transition={{ duration: 0.45, ease: PREMIUM_EASE }}
              className={cn("flex flex-col", isResultsStep ? "h-full gap-5" : "gap-10")}
            >
              {!isResultsStep && activeStep && (
                <>
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1, duration: 0.35 }}
                    className="flex items-center gap-4"
                  >
                    <span className="inline-flex items-center justify-center min-w-[48px] h-12 px-4 bg-[#0F172A] text-white text-[15px] font-[800] rounded-[14px]">
                      {currentStep + 1}
                    </span>
                    <div className="h-px flex-1 bg-[#E2E8F0]" />
                    <span className="text-[14px] font-[700] text-[#94A3B8] uppercase tracking-[1px]">
                      {totalQuestions} perguntas
                    </span>
                  </motion.div>

                  <div>
                    <h2 className="text-[36px] sm:text-[48px] lg:text-[56px] font-[800] text-[#0F172A] tracking-[-1.5px] leading-[1.05]">
                      {activeStep.label}
                    </h2>
                    <p className="text-[18px] lg:text-[20px] text-[#64748B] font-[500] mt-4 leading-relaxed max-w-3xl">
                      {activeStep.description}
                    </p>
                  </div>

                  <div className="w-full min-h-[120px]">
                    {activeStep.render(state, setState)}
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-4 pt-4">
                    {currentStep > 0 && (
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={goBack}
                        className="flex items-center justify-center gap-2 px-8 py-4 text-[16px] font-[700] text-[#64748B] rounded-[16px] hover:bg-[#F5F7FA] transition-colors"
                      >
                        <ArrowLeft className="w-5 h-5" />
                        Voltar
                      </motion.button>
                    )}
                    <div className="flex-1" />
                    {activeStep.skipValue !== undefined && (
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={handleSkip}
                        className="flex items-center justify-center gap-2 px-8 py-4 text-[16px] font-[700] text-[#64748B] rounded-[16px] border-2 border-[#F1F5F9] hover:border-[#E2E8F0] hover:text-[#0F172A] transition-colors"
                      >
                        {activeStep.skipLabel || 'Não se aplica'}
                      </motion.button>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={goNext}
                      className="flex items-center justify-center gap-2 px-10 py-4 bg-[#0F172A] text-white text-[16px] font-[700] rounded-[16px] hover:bg-[#1E293B] transition-colors shadow-xl shadow-[#0F172A]/10"
                    >
                      Próximo
                      <ArrowRight className="w-5 h-5" />
                    </motion.button>
                  </div>
                </>
              )}

              {isResultsStep && (
                <>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1, duration: 0.4, type: 'spring', stiffness: 200 }}
                    className="flex items-center justify-center mb-2"
                  >
                    <div className="bg-[#ECFDF5] text-[#10B981] p-2 rounded-[12px]">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                  </motion.div>

                  <div className="text-center">
                    <h2 className="text-[20px] sm:text-[24px] font-[800] text-[#0F172A] tracking-[-0.5px] leading-tight">
                      {resultsStep.label}
                    </h2>
                    <p className="text-[14px] text-[#64748B] font-[500] mt-1 leading-snug max-w-xl mx-auto">
                      {resultsStep.description}
                    </p>
                  </div>

                  <div className="w-full flex-1 min-h-0 overflow-y-auto">
                    {resultsStep.render}
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4">
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setCurrentStep(0)}
                      className="flex items-center justify-center gap-2 px-8 py-4 text-[16px] font-[700] text-[#64748B] rounded-[16px] hover:bg-[#F5F7FA] transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5" />
                      Refazer
                    </motion.button>
                    <div className="flex-1" />
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={onClose}
                      className="flex items-center justify-center gap-2 px-10 py-4 bg-[#0F172A] text-white text-[16px] font-[700] rounded-[16px] hover:bg-[#1E293B] transition-colors shadow-xl shadow-[#0F172A]/10"
                    >
                      <X className="w-5 h-5" />
                      Fechar vista simplificada
                    </motion.button>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        </div>
      </div>
    </div>
  );
}
