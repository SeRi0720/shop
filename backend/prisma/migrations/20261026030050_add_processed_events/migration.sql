-- CreateTable
CREATE TABLE "processed_events" (
    "id" SERIAL NOT NULL,
    "consumer" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "processed_events_processed_at_idx" ON "processed_events"("processed_at");

-- CreateIndex
CREATE UNIQUE INDEX "processed_events_consumer_event_id_key" ON "processed_events"("consumer", "event_id");
