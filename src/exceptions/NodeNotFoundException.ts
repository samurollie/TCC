export default class NodeNotFoundException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NodeNotFound";
  }
}
