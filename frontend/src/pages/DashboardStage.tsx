import { memo } from 'react'

import {
    SovereignStage,
    FogEnvironment,
    CameraRig,
    ObsidianFloor,
    NeuralMonolith,
    HolographicHUD,
    Effects,
    MonolithState,
} from '../components/3d'


interface DashboardStageProps {
    monolithState: MonolithState
    panels: any[] // We can type this strictly if needed, but keeping it simple for now to match HolographicHUD
}

export const DashboardStage = memo(function DashboardStage({
    monolithState,
    panels,
}: DashboardStageProps) {


    return (
        <div className="fixed inset-0 z-0">
            <SovereignStage>
                <FogEnvironment />
                <CameraRig />
                <ObsidianFloor />
                <NeuralMonolith state={monolithState} />
                <HolographicHUD
                    radius={12}
                    height={3}
                    panels={panels}
                />
                <Effects />
            </SovereignStage>
        </div>
    )
})
