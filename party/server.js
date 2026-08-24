export default class SkribblServer {
  constructor(room) {
    this.room = room;
  }

  // This runs every time a player sends drawing data
  onMessage(message, sender) {
    // Broadcast the data to everyone in the room EXCEPT the person who drew it
    this.room.broadcast(message, [sender.id]);
  }
}