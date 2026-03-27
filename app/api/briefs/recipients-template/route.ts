import { NextResponse } from 'next/server'

export async function GET() {
  const csv = [
    'Namn,E-post,Roll',
    'Anna Lindqvist,anna@bolag.se,Marknadschef',
    'Johan Berg,johan@bolag.se,VD',
    'Fatima Ali,fatima@bolag.se,',
  ].join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="mottagare-mall.csv"',
    },
  })
}
