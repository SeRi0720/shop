export const TOPICS = {
  ORDER_CREATED: 'order.created',
  NOTIFICATION: 'notification',
  ORDER_CREATED_DLT: 'order.created.dlt',
  NOTIFICATION_DLT: 'notification.dlt',
} as const;

export interface TopicSpec {
  topic: string;
  numPartitions: number;
  replicationFactor: number;
}

// Quyết định 4: 3 partition cho 2 topic chính (trần song song của consumer group), 1 cho dead-letter.
export const TOPIC_SPECS: readonly TopicSpec[] = [
  { topic: TOPICS.ORDER_CREATED, numPartitions: 3, replicationFactor: 1 },
  { topic: TOPICS.NOTIFICATION, numPartitions: 3, replicationFactor: 1 },
  { topic: TOPICS.ORDER_CREATED_DLT, numPartitions: 1, replicationFactor: 1 },
  { topic: TOPICS.NOTIFICATION_DLT, numPartitions: 1, replicationFactor: 1 },
];
