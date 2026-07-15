import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker, type DayPickerProps } from 'react-day-picker';
import { es } from 'react-day-picker/locale';
import { cn } from '@/lib/utils';

export type CalendarProps = DayPickerProps;

/** Calendario shadcn/ui sobre `react-day-picker` (MEJ-1), en español. */
function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      locale={es}
      navLayout="around"
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col',
        month: 'relative space-y-3',
        month_caption: 'flex justify-center items-center h-7',
        caption_label: 'text-sm font-medium capitalize',
        button_previous:
          'absolute left-0 top-0 inline-flex h-7 w-7 items-center justify-center rounded-md border border-input bg-transparent opacity-70 hover:opacity-100 disabled:pointer-events-none disabled:opacity-30',
        button_next:
          'absolute right-0 top-0 inline-flex h-7 w-7 items-center justify-center rounded-md border border-input bg-transparent opacity-70 hover:opacity-100 disabled:pointer-events-none disabled:opacity-30',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-9 text-[0.8rem] font-normal text-muted-foreground',
        week: 'mt-1 flex w-full',
        day: cn(
          'h-9 w-9 rounded-md p-0 text-center text-sm',
          '[&[data-selected]]:bg-primary [&[data-selected]]:text-primary-foreground',
          '[&[data-today]:not([data-selected])]:ring-1 [&[data-today]:not([data-selected])]:ring-inset [&[data-today]:not([data-selected])]:ring-foreground/30',
          '[&[data-outside]]:text-muted-foreground [&[data-outside]]:opacity-50',
          '[&[data-disabled]]:text-muted-foreground [&[data-disabled]]:opacity-50',
        ),
        day_button:
          'inline-flex h-9 w-9 items-center justify-center rounded-md p-0 font-normal hover:bg-background',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...chevronProps }) =>
          orientation === 'right' ? (
            <ChevronRight className="h-4 w-4" {...chevronProps} />
          ) : (
            <ChevronLeft className="h-4 w-4" {...chevronProps} />
          ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
