"use client";

import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventInput } from "@fullcalendar/core";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";

type Props = {
  events: EventInput[];
  timezone: string;
};

export function AgendaCalendar({ events, timezone }: Props) {
  return (
    <div className="agenda-calendar border-brand/15 bg-surface rounded-xl border p-3 text-sm">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        locale="es"
        timeZone={timezone}
        height="auto"
        slotMinTime="07:00:00"
        slotMaxTime="21:00:00"
        allDaySlot={false}
        nowIndicator
        events={events}
        buttonText={{
          today: "Hoy",
          month: "Mes",
          week: "Semana",
          day: "Día",
        }}
      />
    </div>
  );
}
