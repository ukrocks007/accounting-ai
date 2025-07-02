import { NextRequest } from "next/server";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

// This endpoint has been removed. Use WebSocket endpoint instead.
export async function GET() {
  return new Response('SSE endpoint removed. Use WebSocket endpoint instead.', { status: 410 });
}

// // Function to broadcast updates to all connected clients watching a specific job
// export function broadcastJobUpdate(filename: string, jobData: any) {
//   sseConnections.forEach(async (writer, clientId) => {
//     try {
//       const message = `event: status\ndata: ${JSON.stringify({
//         type: 'job_status',
//         job: jobData,
//         timestamp: new Date().toISOString()
//       })}\n\n`;
      
//       await writer.write(new TextEncoder().encode(message));
//     } catch (error) {
//       console.error(`Failed to broadcast to client ${clientId}:`, error);
//       sseConnections.delete(clientId);
//     }
//   });
// }

// // Function to get number of active connections
// export function getActiveConnectionsCount(): number {
//   return sseConnections.size;
// }
