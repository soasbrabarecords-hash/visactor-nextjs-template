"use client";

import { format, parseISO } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { DateRangePickerProps } from "@/types/dashboard";
import { cn } from "@/lib/utils";

export function DatePickerWithRange({
  className,
  dateRange,
  setDateRange,
  availableDates,
}: DateRangePickerProps) {
  const firstDate = availableDates[0];
  const lastDate = availableDates[availableDates.length - 1];

  const firstAvailableDate = firstDate ? parseISO(firstDate) : undefined;
  const lastAvailableDate = lastDate ? parseISO(lastDate) : undefined;

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[276px] justify-start text-left font-normal",
              !dateRange && "text-muted-foreground",
            )}
          >
            <CalendarIcon />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "LLL dd, y")} -{" "}
                  {format(dateRange.to, "LLL dd, y")}
                </>
              ) : (
                format(dateRange.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={setDateRange}
            numberOfMonths={2}
            fromDate={firstAvailableDate}
            toDate={lastAvailableDate}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
