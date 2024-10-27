import env from "../config";

export default class HttpClient {
  // Base URL for the API

  public static get baseUrl(): string {
    if (
      window.location.origin.includes("localhost") ||
      window.location.origin.includes("127.0.0.1")
    ) {
      return "http://127.0.0.1:5000";
    }
    return `${window.location.origin}`;
  }

  // Method to perform a GET request
  public static async get<T>(endpoint: string): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}/${endpoint}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          // Add any other headers like Authorization if needed
        },
      });
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      let data = JSON.parse(await response.text());
      return data;
    } catch (error) {
      console.log(error);
      // You could add more error handling logic here
      throw error;
    }
  }

  // Method to perform a POST request
  public static async post<T>(endpoint: string, data: any): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Add any other headers like Authorization if needed
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      // You could add more error handling logic here
      throw error;
    }
  }
}
