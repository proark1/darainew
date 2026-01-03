import { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Check, Trash2 } from 'lucide-react';
import { useHaptics } from '@/hooks/useHaptics';
import { cn } from '@/lib/utils';

interface SwipeableTaskItemProps {
  children: React.ReactNode;
  onComplete?: () => void;
  onDelete?: () => void;
  isCompleted?: boolean;
  disabled?: boolean;
  className?: string;
}

const SWIPE_THRESHOLD = 80;

export function SwipeableTaskItem({
  children,
  onComplete,
  onDelete,
  isCompleted = false,
  disabled = false,
  className,
}: SwipeableTaskItemProps) {
  const [isDragging, setIsDragging] = useState(false);
  const constraintsRef = useRef(null);
  const { vibrate } = useHaptics();
  
  const x = useMotionValue(0);
  
  // Left swipe reveals delete (red)
  const deleteOpacity = useTransform(x, [-SWIPE_THRESHOLD * 1.5, -SWIPE_THRESHOLD, 0], [1, 0.8, 0]);
  const deleteScale = useTransform(x, [-SWIPE_THRESHOLD * 1.5, -SWIPE_THRESHOLD, 0], [1, 0.9, 0.5]);
  
  // Right swipe reveals complete (green)
  const completeOpacity = useTransform(x, [0, SWIPE_THRESHOLD, SWIPE_THRESHOLD * 1.5], [0, 0.8, 1]);
  const completeScale = useTransform(x, [0, SWIPE_THRESHOLD, SWIPE_THRESHOLD * 1.5], [0.5, 0.9, 1]);

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    setIsDragging(false);
    
    if (info.offset.x > SWIPE_THRESHOLD && onComplete && !isCompleted) {
      vibrate('success');
      onComplete();
    } else if (info.offset.x < -SWIPE_THRESHOLD && onDelete) {
      vibrate('warning');
      onDelete();
    }
  };

  if (disabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div ref={constraintsRef} className="relative overflow-hidden rounded-xl">
      {/* Complete action (right swipe) */}
      {!isCompleted && onComplete && (
        <motion.div 
          className="absolute inset-y-0 left-0 w-20 flex items-center justify-center bg-green-500"
          style={{ opacity: completeOpacity }}
        >
          <motion.div style={{ scale: completeScale }}>
            <Check className="w-6 h-6 text-white" />
          </motion.div>
        </motion.div>
      )}
      
      {/* Delete action (left swipe) */}
      {onDelete && (
        <motion.div 
          className="absolute inset-y-0 right-0 w-20 flex items-center justify-center bg-destructive"
          style={{ opacity: deleteOpacity }}
        >
          <motion.div style={{ scale: deleteScale }}>
            <Trash2 className="w-6 h-6 text-white" />
          </motion.div>
        </motion.div>
      )}
      
      {/* Main content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: onDelete ? -SWIPE_THRESHOLD * 1.5 : 0, right: onComplete && !isCompleted ? SWIPE_THRESHOLD * 1.5 : 0 }}
        dragElastic={0.1}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className={cn(
          "relative bg-card cursor-grab active:cursor-grabbing touch-pan-y",
          isDragging && "z-10",
          className
        )}
      >
        {children}
      </motion.div>
    </div>
  );
}
