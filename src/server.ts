import app from "./app";
import { startReminderScheduler } from "./services/reminder.service";

const PORT = parseInt(process.env.PORT ?? "4000", 10);

app.listen(PORT, () => {
  console.log(`🚀  dev-x100 API running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV ?? "development"}`);
  startReminderScheduler();
});
