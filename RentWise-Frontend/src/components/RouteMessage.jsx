import { Link } from 'react-router-dom';

export function RouteMessage({ title, message }) {
  return <main className="mx-auto max-w-xl px-6 py-24 text-center">
    <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
    <p className="my-4 text-gray-600">{message}</p>
    <Link to="/" className="font-medium text-indigo-700 underline">Return home</Link>
  </main>;
}
