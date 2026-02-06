import { useEffect, useState } from "react"

export const useCountdown = (expireAt: number,) => {

    const calculateTimeLeft = () => {
        const difference = expireAt - Date.now()
        return difference > 0 ? Math.floor(difference / 1000) : 0
    }

    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft())

    useEffect(() => {
        setTimeLeft(calculateTimeLeft())

        const timerId = setInterval(() => {
            setTimeLeft(calculateTimeLeft())

            if (calculateTimeLeft() <= 0)
                clearInterval(timerId)
        }, 1000)

        return () => clearInterval(timerId)
    }, [expireAt])

    return { timeLeft }
}