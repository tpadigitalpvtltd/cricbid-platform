import { NextResponse } from 'next/server';
import { getAllPlayers, updatePlayer, deletePlayer } from '@/lib/tournamentStore';
import { verifyAdminSession } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin authentication required' },
        { status: 401 }
      );
    }

    const players = getAllPlayers();
    return NextResponse.json({ success: true, count: players.length, players });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch players' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { registrationId, updates } = body;

    if (!registrationId || !updates) {
      return NextResponse.json(
        { success: false, error: 'registrationId and updates are required' },
        { status: 400 }
      );
    }

    // Only allow updating allowed player fields
    const allowedUpdates = {
      ...(updates.fullName && { fullName: updates.fullName.trim() }),
      ...(updates.phone && { phone: updates.phone.trim() }),
      ...(updates.age && { age: String(updates.age) }),
      ...(updates.role && { role: updates.role }),
      ...(updates.battingStyle && { battingStyle: updates.battingStyle }),
      ...(updates.bowlingStyle && { bowlingStyle: updates.bowlingStyle }),
      ...(updates.stats !== undefined && { stats: updates.stats }),
      ...(updates.paymentStatus && { paymentStatus: updates.paymentStatus }),
      ...(updates.amount !== undefined && { amount: Number(updates.amount) }),
    };

    const updated = updatePlayer(registrationId, allowedUpdates);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Player entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Player entry updated successfully',
      player: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update player entry' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    let registrationId = searchParams.get('registrationId');

    if (!registrationId) {
      const body = await request.json().catch(() => ({}));
      registrationId = body.registrationId;
    }

    if (!registrationId) {
      return NextResponse.json(
        { success: false, error: 'registrationId is required to delete' },
        { status: 400 }
      );
    }

    const deleted = deletePlayer(registrationId);

    return NextResponse.json({
      success: deleted,
      message: deleted ? 'Player registration deleted successfully' : 'Player not found',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to delete player entry' },
      { status: 500 }
    );
  }
}
