import { NextResponse } from 'next/server'

export async function GET() {
  const csv = [
    'Fullständigt namn,E-postadress,Lösenord (valfritt)',
    'Anna Lindqvist,anna.lindqvist@doings.se,Välj123!',
    'Erik Svensson,erik.svensson@doings.se,',
    'Maria Johansson,maria.johansson@doings.se,',
  ].join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="bulk-users-template.csv"',
    },
  })
}
